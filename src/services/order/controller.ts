import { Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { PurchaseOrders } from '../../db/PurchaseOrders';
import 'dotenv/config';
import { InvoicesReceived } from '../../db/InvoicesReceived';

const supplierRepository = AppDataSource.getRepository(Supplier);
const orderRepository = AppDataSource.getRepository(PurchaseOrders);
const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);


//  get Orders  //
export const getOrders = async (token: any, queryData: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier: any = await supplierRepository.findOneBy({
      id: decoded.id,
      email: decoded.email.toLowerCase(),
      isDeleted: false
    });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const supplierCodes = Array.isArray(supplier.supplier_code)
      ? supplier.supplier_code
      : [supplier.supplier_code];

    const limit = Number(queryData?.limit) || 20;
    const page = Number(queryData?.page) || 1;
    const skip = (page - 1) * limit;
    const search = queryData?.search?.trim()?.toLowerCase();

    const orderQuery = orderRepository.createQueryBuilder("order")
      .where("order.supplier_code IN (:...codes)", { codes: supplierCodes });

    if (search) {
      orderQuery.andWhere(
        `(LOWER(order.order_number) ILIKE :search OR LOWER(order.article_code) ILIKE :search)`,
        { search: `%${search}%` }
      );
    }

    const [orders, total] = await orderQuery
      .orderBy("order.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const enrichedOrders = [];

    for (const order of orders) {
      const invoice = await invoiceRepository.findOne({
        where: {
          order_number: order.order_number,
          article_code: order.article_code,
          supplier_code: order.supplier_code,
          isDeleted: false,
        },
      });

      let shippingRate = null;
      if (order.requested_date && invoice?.expected_delivery_date) {
        const requested = new Date(order.requested_date).getTime();
        const expected = new Date(invoice.expected_delivery_date).getTime();
        const diffDays = Math.ceil((expected - requested) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) {
          shippingRate = "On Time";
        } else if (diffDays <= 3) {
          shippingRate = "Slight Delay";
        } else {
          shippingRate = "Delayed";
        }
      }

      enrichedOrders.push({
        ...order,
        invoice: invoice || null,
        accountStatus: supplier.accountVerified ? "Verified" : "Unverified",
        shippingRate,
      });
    }

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.SUCCESS,
      data: enrichedOrders,
      totalRecord: total,
    });
  } catch (error) {
    next(error);
  }
};
