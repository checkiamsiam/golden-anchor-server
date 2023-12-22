import {
  AccountRequest,
  AdminNotificationType,
  Customer,
  Prisma,
  User,
} from "@prisma/client";
import httpStatus from "http-status";
import prismaHelper from "../../helpers/prisma.helper";
import {
  IQueryFeatures,
  IQueryResult,
} from "../../interfaces/queryFeatures.interface";
import prisma from "../../shared/prismaClient";
import { hashPassword } from "../../utils/bcrypt.util";
import AppError from "../../utils/customError.util";
import { generateNewID } from "../../utils/generateId.util";

const create = async (payload: AccountRequest): Promise<AccountRequest> => {
  const result = await prisma.$transaction(async (txc) => {
    const latestPost = await txc.accountRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    payload.id = generateNewID("AR", latestPost[0]?.id);

    const result = await txc.accountRequest.create({
      data: payload,
    });

    await txc.adminNotification.create({
      data: {
        message: `New account request from ${payload.name}`,
        type: AdminNotificationType.AccountRequest,
        title: "New account request",
        refId: result.id,
      },
    });

    return result;
  });

  return result;
};

const getAccountRequests = async (
  queryFeatures: IQueryFeatures
): Promise<IQueryResult<AccountRequest>> => {
  const whereConditions: Prisma.AccountRequestWhereInput =
    prismaHelper.findManyQueryHelper<Prisma.AccountRequestWhereInput>(
      queryFeatures,
      {
        searchFields: ["title"],
      }
    );

  const query: Prisma.AccountRequestFindManyArgs = {
    where: whereConditions,
    skip: queryFeatures.skip || undefined,
    take: queryFeatures.limit || undefined,
    orderBy: queryFeatures.sort,
  };

  if (queryFeatures.fields && Object.keys(queryFeatures.fields).length > 0) {
    query.select = { id: true, ...queryFeatures.fields };
  }

  const [result, count] = await prisma.$transaction([
    prisma.accountRequest.findMany(query),
    prisma.accountRequest.count({ where: whereConditions }),
  ]);

  return {
    data: result,
    total: count,
  };
};

const getSingleAccountRequest = async (
  id: string,
  queryFeatures: IQueryFeatures
): Promise<Partial<AccountRequest> | null> => {
  const query: Prisma.AccountRequestFindUniqueArgs = {
    where: {
      id,
    },
  };

  if (queryFeatures.fields && Object.keys(queryFeatures.fields).length > 0) {
    query.select = { id: true, ...queryFeatures.fields };
  }

  const result: Partial<AccountRequest> | null =
    await prisma.accountRequest.findUnique(query);

  return result;
};

const acceptAccountRequest = async (
  id: string,
  password: string
): Promise<Partial<Customer> | null> => {
  const customer = await prisma.$transaction(async (txc) => {
    const accountRequestData = await txc.accountRequest.delete({
      where: { id },
    });

    if (!accountRequestData) {
      throw new AppError("Account request not found", httpStatus.NOT_FOUND);
    }

    const username =
      accountRequestData.email.split("@")[0] +
      Math.floor(Math.random() * 10) +
      Math.floor(Math.random() * 10);

    const newUserData: Partial<User> = {
      email: accountRequestData.email,
      username,
    };

    newUserData.password = await hashPassword(password);

    const latestPost = await txc.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    const generatedId = generateNewID("U-", latestPost[0]?.id);

    const newCustomerData = {
      id: generatedId,
      name: accountRequestData.name,
      companyName: accountRequestData.companyName,
      companyType: accountRequestData.companyType,
      companyRegNo: accountRequestData.companyRegNo,
      companyDetails: accountRequestData.companyDetails,
      taxNumber: accountRequestData.taxNumber,
      address: accountRequestData.address,
      city: accountRequestData.city,
      country: accountRequestData.country,
      phone: accountRequestData.phone,
    };

    const customer = await txc.customer.create({
      data: newCustomerData,
    });

    newUserData.customerId = customer.id;
    newUserData.id = customer.id;

    await txc.user.create({
      data: {
        ...newUserData,
      } as User,
    });

    return customer;
  });

  return customer;
};

const deleteAccountRequest = async (id: string) => {
  const result: Partial<AccountRequest> | null =
    await prisma.accountRequest.delete({
      where: {
        id,
      },
    });

  return result;
};

const accountReqService = {
  create,
  getAccountRequests,
  getSingleAccountRequest,
  acceptAccountRequest,
  deleteAccountRequest,
};

export default accountReqService;
