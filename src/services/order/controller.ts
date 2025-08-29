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

    // Step 1: Base query (without pagination) for OTIF calculation
    const baseOrderQuery = orderRepository.createQueryBuilder("order")
      .where("order.supplier_code IN (:...codes)", { codes: supplierCodes })
      .andWhere("order.isDeleted = :isDeleted", { isDeleted: false });

    if (search) {
      baseOrderQuery.andWhere(
        `(LOWER(order.order_number) ILIKE :search OR LOWER(order.article_code) ILIKE :search)`,
        { search: `%${search}%` }
      );
    }

    // Fetch ALL orders for OTIF calculation
    const allOrders = await baseOrderQuery.getMany();

    // Calculate OTIF Rate on all data
    let onTimeOrders = 0;
    for (const order of allOrders) {
      const isOnTime =
        order.ordered_quantity <= (order.quantity_arrived || 0) &&
        new Date(order.arrivalDate || Infinity) <= new Date(order.requested_date);

      if (isOnTime) onTimeOrders++;
    }

    const totalAllOrders = allOrders.length;
    const otifRate = totalAllOrders > 0 ? (onTimeOrders / totalAllOrders) * 100 : 0;
    const otifRateWarning = otifRate < 97 ? "" : "";

    // Step 2: Paginated query for current page
    const [orders, total] = await baseOrderQuery
      .orderBy("order.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Enrich only paginated data
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

      const isOnTime =
        order.ordered_quantity <= (order.quantity_arrived || 0) &&
        new Date(order.arrivalDate || Infinity) <= new Date(order.requested_date);

      enrichedOrders.push({
        ...order,
        invoice: invoice || null,
        orderStatus: isOnTime ? "In tempo" : "Non puntuale",
        // shippingRate
      });
    }
    // Shipping Rate as Percentage
    // let shippingRate = null;
    // if (order.requested_date && invoice?.expected_delivery_date) {
    //   const requested = new Date(order.requested_date).getTime();
    //   const expected = new Date(invoice.expected_delivery_date).getTime();
    //   const diffDays = Math.ceil((expected - requested) / (1000 * 60 * 60 * 24));

    //   if (diffDays <= 0) {
    //     shippingRate = 100; // 100% if on time or early
    //   } else {
    //     // Decrease percentage linearly; assume 3 days as the threshold for 0%
    //     const maxDelayThreshold = 3;
    //     shippingRate = Math.max(0, 100 - ((diffDays - 1) / maxDelayThreshold) * 100);
    //   }
    //   shippingRate = Number(shippingRate.toFixed(2)); // Round to 2 decimal places
    // }

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.SUCCESS,
      data: {
        otifRate: `${otifRate.toFixed(2)}%${otifRateWarning}`, //  whole data OTIF
        orders: enrichedOrders, //  only page data
      },
      totalRecord: total,
    });
  } catch (error) {
    next(error);
  }
};
