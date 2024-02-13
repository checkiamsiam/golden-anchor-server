"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../config"));
const prismaClient_1 = __importDefault(require("../../shared/prismaClient"));
const customError_util_1 = __importDefault(require("../../utils/customError.util"));
const generateId_util_1 = require("../../utils/generateId.util");
const sendMail_util_1 = __importDefault(require("../../utils/sendMail.util"));
const requestQuotation = (authUserId, items) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prismaClient_1.default.$transaction((txc) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const latestPost = yield txc.order.findMany({
            orderBy: { createdAt: "desc" },
            take: 1,
        });
        const generatedId = (0, generateId_util_1.generateNewID)("O-", (_a = latestPost[0]) === null || _a === void 0 ? void 0 : _a.id);
        const order = yield txc.order.create({
            data: {
                id: generatedId,
                customerId: authUserId,
                status: client_1.OrderStatus.requestQuotation,
            },
        });
        const orderItemsData = items.map((item) => {
            return {
                orderId: order.id,
                productId: item.productId,
                quantity: item.quantity,
            };
        });
        yield txc.orderItem.createMany({
            data: orderItemsData,
        });
        const orderResponse = yield txc.order.findUnique({
            where: {
                id: order.id,
            },
            include: {
                _count: true,
                products: true,
                customer: true,
            },
        });
        yield txc.adminNotification.create({
            data: {
                message: `${(_b = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _b === void 0 ? void 0 : _b.name} asked for quotation For Order Id: ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}`,
                type: client_1.AdminNotificationType.quotationRequest,
                title: "New Quotation request",
                refId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id,
            },
        });
        yield (0, sendMail_util_1.default)({
            to: config_1.default.adminEmail,
            subject: "New Quotation request",
            html: `
      <h3>New Quotation request</h3>
      <p>Hi, Admin</p>
      <p>${(_c = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _c === void 0 ? void 0 : _c.name} asked quotation For Order Id: ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}</p>
      <p>Please check your admin panel</p>
      <p>Thank you</p>
      `,
        });
        return orderResponse;
    }), { timeout: 20000 });
    if (!result) {
        throw new customError_util_1.default("Order not created", http_status_1.default.INTERNAL_SERVER_ERROR);
    }
    return result;
});
const getSingleOrder = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prismaClient_1.default.order.findUnique({
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
});
const getOrders = (status, queryFeatures) => __awaiter(void 0, void 0, void 0, function* () {
    const whereConditions = {
        AND: [
            {
                status: {
                    in: status,
                },
            },
            Object.assign({}, queryFeatures.filters),
        ],
    };
    const query = {
        where: whereConditions,
        skip: queryFeatures.skip || undefined,
        take: queryFeatures.limit || undefined,
        orderBy: queryFeatures.sort,
    };
    if (queryFeatures.populate && Object.keys(queryFeatures.populate).length > 0) {
        query.include = Object.assign({ _count: true }, queryFeatures.populate);
    }
    else {
        if (queryFeatures.fields && Object.keys(queryFeatures.fields).length > 0) {
            query.select = Object.assign({ id: true }, queryFeatures.fields);
        }
    }
    const [result, count] = yield prismaClient_1.default.$transaction([prismaClient_1.default.order.findMany(query), prismaClient_1.default.order.count({ where: whereConditions })]);
    return {
        data: result,
        total: count,
    };
});
const getMyOrders = (status, authUserId, queryFeatures) => __awaiter(void 0, void 0, void 0, function* () {
    const whereConditions = {
        AND: [
            {
                customerId: authUserId,
            },
            {
                status: {
                    in: status,
                },
            },
            Object.assign({}, queryFeatures.filters),
        ],
    };
    const query = {
        where: whereConditions,
        skip: queryFeatures.skip || undefined,
        take: queryFeatures.limit || undefined,
        orderBy: queryFeatures.sort,
    };
    if (queryFeatures.populate && Object.keys(queryFeatures.populate).length > 0) {
        query.include = Object.assign({ _count: true }, queryFeatures.populate);
    }
    else {
        if (queryFeatures.fields && Object.keys(queryFeatures.fields).length > 0) {
            query.select = Object.assign({ id: true }, queryFeatures.fields);
        }
    }
    const [result, count] = yield prismaClient_1.default.$transaction([prismaClient_1.default.order.findMany(query), prismaClient_1.default.order.count({ where: whereConditions })]);
    return {
        data: result,
        total: count,
    };
});
const quotationApprove = (id, quotationFilePath) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prismaClient_1.default.$transaction((txc) => __awaiter(void 0, void 0, void 0, function* () {
        var _d, _e, _f;
        const order = yield txc.order.findUnique({
            where: {
                id,
            },
        });
        if (!order || order.status !== client_1.OrderStatus.requestQuotation) {
            throw new customError_util_1.default("Order you want to approve is not requested yet or already approved", http_status_1.default.NOT_FOUND);
        }
        const orderResponse = yield txc.order.update({
            where: {
                id,
            },
            data: {
                status: client_1.OrderStatus.quotationApproved,
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
        yield txc.customerNotification.create({
            data: {
                message: `Your quotation request for order id ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id} is approved`,
                type: client_1.CustomerNotificationType.quotationApproved,
                title: "Quotation request approved",
                refId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id,
                customerId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customerId,
            },
        });
        yield (0, sendMail_util_1.default)({
            to: (_e = (_d = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _d === void 0 ? void 0 : _d.user) === null || _e === void 0 ? void 0 : _e.email,
            subject: "Quotation request approved",
            html: `
    <h3>Quotation request approved</h3>
    <p>Hi, ${(_f = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _f === void 0 ? void 0 : _f.name}</p>
    <p>Your quotation request for order id ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id} has been approved</p>
    <p> <a href=${quotationFilePath}> Click here </a> to download the quotation</p>
    <p>Thank you</p>
    `,
        });
        return orderResponse;
    }), { timeout: 20000 });
    if (!result) {
        throw new customError_util_1.default("Order not updated", http_status_1.default.INTERNAL_SERVER_ERROR);
    }
    return result;
});
const updateOrderStatus = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prismaClient_1.default.$transaction((txc) => __awaiter(void 0, void 0, void 0, function* () {
        var _g, _h, _j, _k, _l, _m;
        const orderResponse = yield txc.order.update({
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
        if (payload.status === client_1.OrderStatus.spam) {
            yield txc.customerNotification.create({
                data: {
                    message: `Quotation request for order id ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id} is declined`,
                    type: client_1.CustomerNotificationType.quotationDeclined,
                    title: "Quotation Request declined",
                    refId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id,
                    customerId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customerId,
                },
            });
            yield (0, sendMail_util_1.default)({
                to: (_h = (_g = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _g === void 0 ? void 0 : _g.user) === null || _h === void 0 ? void 0 : _h.email,
                subject: "Quotation Request declined",
                html: `
    <h3>Quotation Request declined</h3>
    <p>Hi, ${(_j = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _j === void 0 ? void 0 : _j.name}</p>
    <p>Quotation request for order id ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id} is declined</p>
    <p>Please contact us for more information</p>
    <p>Thank you</p>
    `,
            });
        }
        else {
            yield (0, sendMail_util_1.default)({
                to: (_l = (_k = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _k === void 0 ? void 0 : _k.user) === null || _l === void 0 ? void 0 : _l.email,
                subject: "Order Status Updated",
                html: `
    <h3>Order Status Updated</h3>
    <p>Hi, ${(_m = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _m === void 0 ? void 0 : _m.name}</p>
    <p>Order status for order id ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id} is now ${payload.status}</p>
    <p>Please contact us for more information</p>
    <p>Thank you</p>
    `,
            });
        }
        return orderResponse;
    }), { timeout: 20000 });
    if (!result) {
        throw new customError_util_1.default("Order not updated", http_status_1.default.INTERNAL_SERVER_ERROR);
    }
    return result;
});
const confirmOrDeclineOrder = (id, authUserId, status) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prismaClient_1.default.$transaction((txc) => __awaiter(void 0, void 0, void 0, function* () {
        var _o, _p, _q, _r;
        const order = yield txc.order.findUnique({
            where: {
                id,
            },
        });
        if (!order || order.status !== client_1.OrderStatus.quotationApproved || order.customerId !== authUserId) {
            throw new customError_util_1.default("Order you want to confirm/decline is not approved yet or already confirm or its to her/his order", http_status_1.default.NOT_FOUND);
        }
        const orderResponse = yield txc.order.update({
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
        if (status === client_1.OrderStatus.ordered) {
            yield txc.adminNotification.create({
                data: {
                    message: `${(_o = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _o === void 0 ? void 0 : _o.name} confirmed the order For Order Id: ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}`,
                    type: client_1.AdminNotificationType.confirmOrder,
                    title: "Order confirmed",
                    refId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id,
                },
            });
            yield (0, sendMail_util_1.default)({
                to: config_1.default.adminEmail,
                subject: "Order confirmed",
                html: `
        <h3>Order confirmed</h3>
        <p>Hi, Admin</p>
        <p>${(_p = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _p === void 0 ? void 0 : _p.name} confirmed the order For Order Id: ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}</p>
        <p>Please check your admin panel</p>
        <p>Thank you</p>
        `,
            });
        }
        if (status === client_1.OrderStatus.declined) {
            yield txc.adminNotification.create({
                data: {
                    message: `${(_q = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _q === void 0 ? void 0 : _q.name} declined the order For Order Id: ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}`,
                    type: client_1.AdminNotificationType.declineOrder,
                    title: "Order declined",
                    refId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id,
                },
            });
            yield (0, sendMail_util_1.default)({
                to: config_1.default.adminEmail,
                subject: "Order declined",
                html: `
        <h3>Order declined</h3>
        <p>Hi, Admin</p>
        <p>${(_r = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _r === void 0 ? void 0 : _r.name} declined the order For Order Id: ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}</p>
        <p>Please check your admin panel</p>
        <p>Thank you</p>
        `,
            });
        }
        return orderResponse;
    }), { timeout: 20000 });
    if (!result) {
        throw new customError_util_1.default("Order not updated", http_status_1.default.INTERNAL_SERVER_ERROR);
    }
    return result;
});
const invoiceUpload = (id, invoiceFilePath) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prismaClient_1.default.$transaction((txc) => __awaiter(void 0, void 0, void 0, function* () {
        var _s, _t, _u;
        const order = yield txc.order.findUnique({
            where: {
                id,
            },
        });
        if (!order || order.status !== client_1.OrderStatus.ordered) {
            throw new customError_util_1.default("Order you want to approve is not requested yet or already approved", http_status_1.default.NOT_FOUND);
        }
        const orderResponse = yield txc.order.update({
            where: {
                id,
            },
            data: {
                status: client_1.OrderStatus.orderInProcess,
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
        yield txc.customerNotification.create({
            data: {
                message: `Invoice added for your order id ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}`,
                type: client_1.CustomerNotificationType.invoiceAdded,
                title: "Invoice Added",
                refId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id,
                customerId: orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customerId,
            },
        });
        yield (0, sendMail_util_1.default)({
            to: (_t = (_s = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _s === void 0 ? void 0 : _s.user) === null || _t === void 0 ? void 0 : _t.email,
            subject: `Invoice Added - ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}`,
            html: `
  <h3>Invoice Added</h3>
  <p>Hi, ${(_u = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.customer) === null || _u === void 0 ? void 0 : _u.name}</p>
  <p>Invoice added for your order id ${orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.id}</p>
  <p> <a href=${invoiceFilePath}> Click here </a> to download the quotation</p>
  <p>Thank you</p>
  `,
        });
        return orderResponse;
    }), { timeout: 20000 });
    if (!result) {
        throw new customError_util_1.default("Order not updated", http_status_1.default.INTERNAL_SERVER_ERROR);
    }
    return result;
});
const makeUnConfirmedOrderToSpamStatus = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentDate = new Date();
        // 3 days in milliseconds
        const threeDaysAgo = new Date(currentDate.getTime() - 259200000); // 3 days in milliseconds
        yield prismaClient_1.default.order.updateMany({
            where: {
                AND: [
                    { status: client_1.OrderStatus.quotationApproved },
                    {
                        createdAt: {
                            lt: threeDaysAgo,
                        },
                    },
                ],
            },
            data: {
                status: client_1.OrderStatus.spam,
            },
        });
    }
    catch (error) {
        console.log(error);
    }
});
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
exports.default = orderService;
