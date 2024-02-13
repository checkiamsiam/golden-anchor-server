import {
  AdminNotificationType,
  CustomerNotificationType,
  Order,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import httpStatus from "http-status";
import config from "../../config";
import {
  IQueryFeatures,
  IQueryResult,
} from "../../interfaces/queryFeatures.interface";
import prisma from "../../shared/prismaClient";
import AppError from "../../utils/customError.util";
import { generateNewID } from "../../utils/generateId.util";
import sendEmail from "../../utils/sendMail.util";

const requestQuotation = async (
  authUserId: string,
  items: { productId: string; quantity: number }[]
): Promise<Order> => {
  const result = await prisma.$transaction(
    async (txc) => {
      const latestPost = await txc.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      const generatedId = generateNewID("O-", latestPost[0]?.id);

      const order = await txc.order.create({
        data: {
          id: generatedId,
          customerId: authUserId,
          status: OrderStatus.requestQuotation,
        },
      });

      const orderItemsData = items.map((item) => {
        return {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
        };
      });

      await txc.orderItem.createMany({
        data: orderItemsData,
      });

      const orderResponse = await txc.order.findUnique({
        where: {
          id: order.id,
        },
        include: {
          _count: true,
          products: true,
          customer: true,
        },
      });

      await txc.adminNotification.create({
        data: {
          message: `${orderResponse?.customer?.name} asked for quotation For Order Id: ${orderResponse?.id}`,
          type: AdminNotificationType.quotationRequest,
          title: "New Quotation request",
          refId: orderResponse?.id,
        },
      });

      await sendEmail({
        to: config.adminEmail,
        subject: "New Quotation request",
        html: `
      <h3>New Quotation request</h3>
      <p>Hi, Admin</p>
      <p>${orderResponse?.customer?.name} asked quotation For Order Id: ${orderResponse?.id}</p>
      <p>Please check your admin panel</p>
      <p>Thank you</p>
      `,
      });

      return orderResponse;
    },
    { timeout: 20000 }
  );

  if (!result) {
    throw new AppError("Order not created", httpStatus.INTERNAL_SERVER_ERROR);
  }

  return result;
};

const getSingleOrder = async (id: string): Promise<Partial<Order> | null> => {
  const result: Partial<Order> | null = await prisma.order.findUnique({
    where: {
      id,
    },
    include: {
      _count: true,
      products: {
        include: {
          product: true,
          order: true,
        },
      },
      customer: true,
    },
  });

  return result;
};

const getOrders = async (
  status: OrderStatus[],
  queryFeatures: IQueryFeatures
): Promise<IQueryResult<Order>> => {
  const whereConditions: Prisma.OrderWhereInput = {
    AND: [
      {
        status: {
          in: status,
        },
      },
      {
        ...queryFeatures.filters,
      },
    ],
  };

  const query: Prisma.OrderFindManyArgs = {
    where: whereConditions,
    skip: queryFeatures.skip || undefined,
    take: queryFeatures.limit || undefined,
    orderBy: queryFeatures.sort,
  };

  if (
    queryFeatures.populate &&
    Object.keys(queryFeatures.populate).length > 0
  ) {
    query.include = {
      _count: true,
      ...queryFeatures.populate,
    };
  } else {
    if (queryFeatures.fields && Object.keys(queryFeatures.fields).length > 0) {
      query.select = { id: true, ...queryFeatures.fields };
    }
  }
  const [result, count] = await prisma.$transaction([
    prisma.order.findMany(query),
    prisma.order.count({ where: whereConditions }),
  ]);

  return {
    data: result,
    total: count,
  };
};

const getMyOrders = async (
  status: OrderStatus[],
  authUserId: string,
  queryFeatures: IQueryFeatures
): Promise<IQueryResult<Order>> => {
  const whereConditions: Prisma.OrderWhereInput = {
    AND: [
      {
        customerId: authUserId,
      },
      {
        status: {
          in: status,
        },
      },
      {
        ...queryFeatures.filters,
      },
    ],
  };
  const query: Prisma.OrderFindManyArgs = {
    where: whereConditions,
    skip: queryFeatures.skip || undefined,
    take: queryFeatures.limit || undefined,
    orderBy: queryFeatures.sort,
  };

  if (
    queryFeatures.populate &&
    Object.keys(queryFeatures.populate).length > 0
  ) {
    query.include = {
      _count: true,
      ...queryFeatures.populate,
    };
  } else {
    if (queryFeatures.fields && Object.keys(queryFeatures.fields).length > 0) {
      query.select = { id: true, ...queryFeatures.fields };
    }
  }
  const [result, count] = await prisma.$transaction([
    prisma.order.findMany(query),
    prisma.order.count({ where: whereConditions }),
  ]);

  return {
    data: result,
    total: count,
  };
};

const quotationApprove = async (
  id: string,
  quotationFilePath: string
): Promise<Order> => {
  const result = await prisma.$transaction(
    async (txc) => {
      const order = await txc.order.findUnique({
        where: {
          id,
        },
      });

      if (!order || order.status !== OrderStatus.requestQuotation) {
        throw new AppError(
          "Order you want to approve is not requested yet or already approved",
          httpStatus.NOT_FOUND
        );
      }

      const orderResponse = await txc.order.update({
        where: {
          id,
        },
        data: {
          status: OrderStatus.quotationApproved,
          quotation: quotationFilePath,
        },
        include: {
          _count: true,
          products: true,
          customer: {
            include: {
              user: true,
            },
          },
        },
      });

      await txc.customerNotification.create({
        data: {
          message: `Your quotation request for order id ${orderResponse?.id} is approved`,
          type: CustomerNotificationType.quotationApproved,
          title: "Quotation request approved",
          refId: orderResponse?.id,
          customerId: orderResponse?.customerId,
        },
      });

      await sendEmail({
        to: orderResponse?.customer?.user?.email as string,
        subject: "Quotation request approved",
        html: `
    <h3>Quotation request approved</h3>
    <p>Hi, ${orderResponse?.customer?.name}</p>
    <p>Your quotation request for order id ${orderResponse?.id} has been approved</p>
    <p> <a href=${quotationFilePath}> Click here </a> to download the quotation</p>
    <p>Thank you</p>
    `,
      });

      return orderResponse;
    },
    { timeout: 20000 }
  );

  if (!result) {
    throw new AppError("Order not updated", httpStatus.INTERNAL_SERVER_ERROR);
  }

  return result;
};

const updateOrderStatus = async (
  id: string,
  payload: Partial<Order>
): Promise<Order> => {
  const result = await prisma.$transaction(
    async (txc) => {
      const orderResponse = await txc.order.update({
        where: {
          id,
        },
        data: payload,
        include: {
          _count: true,
          products: true,
          customer: {
            include: {
              user: true,
            },
          },
        },
      });

      if (payload.status === OrderStatus.spam) {
        await txc.customerNotification.create({
          data: {
            message: `Quotation request for order id ${orderResponse?.id} is declined`,
            type: CustomerNotificationType.quotationDeclined,
            title: "Quotation Request declined",
            refId: orderResponse?.id,
            customerId: orderResponse?.customerId,
          },
        });

        await sendEmail({
          to: orderResponse?.customer?.user?.email as string,
          subject: "Quotation Request declined",
          html: `
    <h3>Quotation Request declined</h3>
    <p>Hi, ${orderResponse?.customer?.name}</p>
    <p>Quotation request for order id ${orderResponse?.id} is declined</p>
    <p>Please contact us for more information</p>
    <p>Thank you</p>
    `,
        });
      } else {
        await sendEmail({
          to: orderResponse?.customer?.user?.email as string,
          subject: "Order Status Updated",
          html: `
    <h3>Order Status Updated</h3>
    <p>Hi, ${orderResponse?.customer?.name}</p>
    <p>Order status for order id ${orderResponse?.id} is now ${payload.status}</p>
    <p>Please contact us for more information</p>
    <p>Thank you</p>
    `,
        });
      }

      return orderResponse;
    },
    { timeout: 20000 }
  );

  if (!result) {
    throw new AppError("Order not updated", httpStatus.INTERNAL_SERVER_ERROR);
  }

  return result;
};

const confirmOrDeclineOrder = async (
  id: string,
  authUserId: string,
  status: OrderStatus
): Promise<Order> => {
  const result = await prisma.$transaction(
    async (txc) => {
      const order = await txc.order.findUnique({
        where: {
          id,
        },
      });

      if (
        !order ||
        order.status !== OrderStatus.quotationApproved ||
        order.customerId !== authUserId
      ) {
        throw new AppError(
          "Order you want to confirm/decline is not approved yet or already confirm or its to her/his order",
          httpStatus.NOT_FOUND
        );
      }

      const orderResponse = await txc.order.update({
        where: {
          id,
        },
        data: {
          status: status,
        },
        include: {
          _count: true,
          products: true,
          customer: true,
        },
      });

      if (status === OrderStatus.ordered) {
        await txc.adminNotification.create({
          data: {
            message: `${orderResponse?.customer?.name} confirmed the order For Order Id: ${orderResponse?.id}`,
            type: AdminNotificationType.confirmOrder,
            title: "Order confirmed",
            refId: orderResponse?.id,
          },
        });
        await sendEmail({
          to: config.adminEmail,
          subject: "Order confirmed",
          html: `
        <h3>Order confirmed</h3>
        <p>Hi, Admin</p>
        <p>${orderResponse?.customer?.name} confirmed the order For Order Id: ${orderResponse?.id}</p>
        <p>Please check your admin panel</p>
        <p>Thank you</p>
        `,
        });
      }

      if (status === OrderStatus.declined) {
        await txc.adminNotification.create({
          data: {
            message: `${orderResponse?.customer?.name} declined the order For Order Id: ${orderResponse?.id}`,
            type: AdminNotificationType.declineOrder,
            title: "Order declined",
            refId: orderResponse?.id,
          },
        });
        await sendEmail({
          to: config.adminEmail,
          subject: "Order declined",
          html: `
        <h3>Order declined</h3>
        <p>Hi, Admin</p>
        <p>${orderResponse?.customer?.name} declined the order For Order Id: ${orderResponse?.id}</p>
        <p>Please check your admin panel</p>
        <p>Thank you</p>
        `,
        });
      }

      return orderResponse;
    },
    { timeout: 20000 }
  );

  if (!result) {
    throw new AppError("Order not updated", httpStatus.INTERNAL_SERVER_ERROR);
  }

  return result;
};

const invoiceUpload = async (
  id: string,
  invoiceFilePath: string
): Promise<Order> => {
  const result = await prisma.$transaction(
    async (txc) => {
      const order = await txc.order.findUnique({
        where: {
          id,
        },
      });

      if (!order || order.status !== OrderStatus.ordered) {
        throw new AppError(
          "Order you want to approve is not requested yet or already approved",
          httpStatus.NOT_FOUND
        );
      }

      const orderResponse = await txc.order.update({
        where: {
          id,
        },
        data: {
          status: OrderStatus.orderInProcess,
          invoice: invoiceFilePath,
        },
        include: {
          _count: true,
          products: true,
          customer: {
            include: {
              user: true,
            },
          },
        },
      });

      await txc.customerNotification.create({
        data: {
          message: `Invoice added for your order id ${orderResponse?.id}`,
          type: CustomerNotificationType.invoiceAdded,
          title: "Invoice Added",
          refId: orderResponse?.id,
          customerId: orderResponse?.customerId,
        },
      });

      await sendEmail({
        to: orderResponse?.customer?.user?.email as string,
        subject: `Invoice Added - ${orderResponse?.id}`,
        html: `
  <h3>Invoice Added</h3>
  <p>Hi, ${orderResponse?.customer?.name}</p>
  <p>Invoice added for your order id ${orderResponse?.id}</p>
  <p> <a href=${invoiceFilePath}> Click here </a> to download the quotation</p>
  <p>Thank you</p>
  `,
      });

      return orderResponse;
    },
    { timeout: 20000 }
  );

  if (!result) {
    throw new AppError("Order not updated", httpStatus.INTERNAL_SERVER_ERROR);
  }

  return result;
};

const makeUnConfirmedOrderToSpamStatus = async () => {
  try {
    const currentDate = new Date();
    // 3 days in milliseconds
    const threeDaysAgo = new Date(currentDate.getTime() - 259200000); // 3 days in milliseconds
    await prisma.order.updateMany({
      where: {
        AND: [
          { status: OrderStatus.quotationApproved },
          {
            createdAt: {
              lt: threeDaysAgo,
            },
          },
        ],
      },
      data: {
        status: OrderStatus.spam,
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const orderService = {
  requestQuotation,
  getOrders,
  getMyOrders,
  getSingleOrder,
  quotationApprove,
  confirmOrDeclineOrder,
  updateOrderStatus,
  invoiceUpload,
  makeUnConfirmedOrderToSpamStatus,
};

export default orderService;
