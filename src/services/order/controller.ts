import { Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { PurchaseOrders } from '../../db/PurchaseOrders';
import 'dotenv/config';


//  get Orders  //
export const getOrders = async (token: any, queryData: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const userRepository = AppDataSource.getRepository(Supplier);
    const user: any = await userRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase() });
    if (!user) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const orderRepository = AppDataSource.getRepository(PurchaseOrders);
    const limit = queryData?.limit || 10;
    const page = queryData?.page || 1;

    const [orderList, total] = await orderRepository.findAndCount({
      where: { supplier: user }, // Filter
      skip: (page - 1) * limit, // Skip records based on pagination
      take: limit, // Number of records per page
      order: { id: "DESC" }, // Sort by latest
    });

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.SUCCESS,
      data: orderList,
      totalRecord: total,
    });

  } catch (error) {
    next(error)
  }
};
