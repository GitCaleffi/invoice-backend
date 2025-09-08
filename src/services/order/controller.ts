import { Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { PurchaseOrders } from '../../db/PurchaseOrders';
import 'dotenv/config';
import { InvoicesReceived } from '../../db/InvoicesReceived';
import { In } from 'typeorm';
import { HTTP400Error } from '../../utils/httpErrors';

const supplierRepository = AppDataSource.getRepository(Supplier);
const orderRepository = AppDataSource.getRepository(PurchaseOrders);
const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);


//  get Orders  //
// export const getOrders = async (token: any, queryData: any, res: Response, next: NextFunction) => {
//   try {
//     const decoded: any = await CommonUtilities.getDecoded(token);
//     const supplier: any = await supplierRepository.findOneBy({
//       id: decoded.id,
//       email: decoded.email.toLowerCase(),
//       isDeleted: false
//     });

//     if (!supplier) {
//       return res.status(400).json(CommonUtilities.sendResponsData({
//         code: 400,
//         message: MESSAGES.USER_NOT_EXISTS,
//       }));
//     }

//     const supplierCodes = Array.isArray(supplier.supplier_code)
//       ? supplier.supplier_code
//       : [supplier.supplier_code];

//     const limit = Number(queryData?.limit) || 20;
//     const page = Number(queryData?.page) || 1;
//     const skip = (page - 1) * limit;
//     const search = queryData?.search?.trim()?.toLowerCase();

//     // Step 1: Base query (without pagination) for OTIF calculation
//     const baseOrderQuery = orderRepository.createQueryBuilder("po")
//       .where("po.supplier_code IN (:...codes)", { codes: supplierCodes })
//       .andWhere("po.isDeleted = :isDeleted", { isDeleted: false });

//     if (search) {
//       baseOrderQuery.andWhere(
//         `(LOWER(po.order_number) ILIKE :search OR LOWER(po.article_code) ILIKE :search)`,
//         { search: `%${search}%` }
//       );
//     }

//     // Fetch ALL orders for OTIF calculation
//     const allOrders = await baseOrderQuery.getMany();

//     // Calculate OTIF Rate on all data
//     let onTimeOrders = 0;
//     for (const order of allOrders) {
//       const isOnTime =
//         order.ordered_quantity <= (order.quantity_arrived || 0) &&
//         new Date(order.arrivalDate || Infinity) <= new Date(order.requested_date);

//       if (isOnTime) onTimeOrders++;
//     }

//     const totalAllOrders = allOrders.length;
//     const otifRate = totalAllOrders > 0 ? (onTimeOrders / totalAllOrders) * 100 : 0;
//     const otifRateWarning = otifRate < 97 ? "" : "";

//     // Step 2: Paginated query for current page
//     const [orders, total] = await baseOrderQuery
//       .orderBy("po.createdAt", "DESC")
//       .skip(skip)
//       .take(limit)
//       .getManyAndCount();

//     // Enrich only paginated data
//     const enrichedOrders = [];
//     for (const order of orders) {
//       const invoice = await invoiceRepository.findOne({
//         where: {
//           order_number: order.order_number,
//           article_code: order.article_code,
//           supplier_code: order.supplier_code,
//           isDeleted: false,
//         },
//       });

//       const isOnTime =
//         order.ordered_quantity <= (order.quantity_arrived || 0) &&
//         new Date(order.arrivalDate || Infinity) <= new Date(order.requested_date);

//       enrichedOrders.push({
//         ...order,
//         invoice: invoice || null,
//         orderStatus: isOnTime ? "In tempo" : "Non puntuale",
//         // shippingRate
//       });
//     }
//     // Shipping Rate as Percentage
//     // let shippingRate = null;
//     // if (order.requested_date && invoice?.expected_delivery_date) {
//     //   const requested = new Date(order.requested_date).getTime();
//     //   const expected = new Date(invoice.expected_delivery_date).getTime();
//     //   const diffDays = Math.ceil((expected - requested) / (1000 * 60 * 60 * 24));

//     //   if (diffDays <= 0) {
//     //     shippingRate = 100; // 100% if on time or early
//     //   } else {
//     //     // Decrease percentage linearly; assume 3 days as the threshold for 0%
//     //     const maxDelayThreshold = 3;
//     //     shippingRate = Math.max(0, 100 - ((diffDays - 1) / maxDelayThreshold) * 100);
//     //   }
//     //   shippingRate = Number(shippingRate.toFixed(2)); // Round to 2 decimal places
//     // }

//     // ✅ Group by order_number with OTIF per group
//     const groupedOrders = Object.values(
//       orders.reduce((acc: any, order: any) => {
//         if (!acc[order.order_number]) {
//           acc[order.order_number] = {
//             order_number: order.order_number,
//             total_records: 0,
//             ordered_quantity: 0,
//             quantity_received: 0,
//             onTimeCount: 0,
//             totalCount: 0,
//           };
//         }

//         const group = acc[order.order_number];
//         group.total_records += 1;
//         group.ordered_quantity += order.ordered_quantity || 0;
//         group.quantity_received += order.quantity_arrived || 0;
//         group.totalCount += 1;

//         const isOnTime =
//           order.ordered_quantity <= (order.quantity_arrived || 0) &&
//           new Date(order.arrivalDate || Infinity) <= new Date(order.requested_date);

//         if (isOnTime) group.onTimeCount += 1;

//         return acc;
//       }, {})
//     ).map((group: any) => {
//       const orderOTIF =
//         group.totalCount > 0 ? (group.onTimeCount / group.totalCount) * 100 : 0;

//       return {
//         order_number: group.order_number,
//         total_records: group.total_records,
//         ordered_quantity: group.ordered_quantity,
//         quantity_received: group.quantity_received,
//         orderOTIF: `${orderOTIF.toFixed(2)}%`,
//         deliveryStatus: orderOTIF >= 97 ? "On Time" : "Late",
//       };
//     });


//     return CommonUtilities.sendResponsData({
//       code: 200,
//       message: MESSAGES.SUCCESS,
//       data: {
//         otifRate: `${otifRate.toFixed(2)}%${otifRateWarning}`, //  whole data OTIF
//         orders: groupedOrders, //  only page data
//       },
//       totalRecord: total,
//     });
//   } catch (error) {
//     next(error);
//   }
// };


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

    // Step 1: Global OTIF Rate

    const allOrders = await orderRepository.createQueryBuilder("po")
      .where("po.supplier_code IN (:...codes)", { codes: supplierCodes })
      .andWhere("po.isDeleted = false")
      .getMany();

    let onTimeOrders = 0;
    for (const order of allOrders) {
      const isOnTime =
        order.ordered_quantity <= (order.quantity_arrived || 0) &&
        new Date(order.arrivalDate || Infinity) <= new Date(order.requested_date);
      if (isOnTime) onTimeOrders++;
    }
    const totalAllOrders = allOrders.length;
    const otifRate = totalAllOrders > 0 ? (onTimeOrders / totalAllOrders) * 100 : 0;

    // Step 2: Aggregated query per order_number

    let qb = orderRepository.createQueryBuilder("po")
      .select("po.order_number", "order_number")
      .addSelect("COUNT(*)", "total_records")
      .addSelect("SUM(po.ordered_quantity)", "ordered_quantity")
      // .addSelect("SUM(po.quantity_arrived)", "quantity_received")
      .addSelect("SUM(COALESCE(po.quantity_arrived,0))", "quantity_received")
      .addSelect("MIN(po.requested_date)", "nearest_requested_date")
      .addSelect(`
        SUM(
          CASE 
            WHEN po.ordered_quantity <= COALESCE(po.quantity_arrived,0) 
              AND COALESCE(po.arrivalDate, '9999-12-31') <= po.requested_date
            THEN 1 ELSE 0
          END
        )
      `, "onTimeCount")
      .addSelect(`
        SUM(
          CASE 
            WHEN LOWER(COALESCE(po.status, 'open')) = 'close' THEN 1 
            ELSE 0 
          END
        )
      `, "closedCount")
      .where("po.supplier_code IN (:...codes)", { codes: supplierCodes })
      .andWhere("po.isDeleted = false");

    if (search) {
      qb = qb.andWhere(`(LOWER(po.order_number) ILIKE :search OR LOWER(po.article_code) ILIKE :search)`, { search: `%${search}%` });
    }

    qb = qb.groupBy("po.order_number")
      .orderBy("MAX(po.createdAt)", "DESC");

    // Total groups (for pagination)
    const totalGroupsRaw = await qb.clone().getRawMany();
    const totalGroups = totalGroupsRaw.length;

    // Paginate aggregated results
    const groupedOrdersRaw = await qb.skip(skip).take(limit).getRawMany();

    // Transform raw results
    const groupedOrders = groupedOrdersRaw.map((g: any) => {
      const totalRecords = Number(g.total_records) || 0;
      const onTimeCount = Number(g.ontimecount) || 0;
      const closedCount = Number(g.closedcount) || 0;

      const orderOTIF = totalRecords > 0 ? (onTimeCount / totalRecords) * 100 : 0;

      // const deliveryStatus = onTimeCount === totalRecords ? "In tempo" : "Tardi";

      let deliveryStatus = "Tardi"; // default
      if (onTimeCount === totalRecords) {
        deliveryStatus = "In tempo";
      } else if (!g.nearest_requested_date || g.nearest_requested_date === null) {
        deliveryStatus = "Tardi";
      } else {
        const reqDate = new Date(g.nearest_requested_date);
        const now = new Date();
        // arrivalDate missing check
        if (!g.arrivaldate && reqDate > now) {
          deliveryStatus = "ordine da evadere"; // pending status
        }
      }

      const orderStatus = closedCount === totalRecords ? "Chiuso" : "Aprire";

      return {
        order_number: g.order_number,
        total_records: totalRecords,
        ordered_quantity: Number(g.ordered_quantity) || 0,
        quantity_received: Number(g.quantity_received) || 0,
        nearest_requested_date: g.nearest_requested_date,
        orderOTIF: `${orderOTIF.toFixed(2)}%`,
        deliveryStatus,
        orderStatus
      };
    });

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.SUCCESS,
      data: {
        otifRate: `${otifRate.toFixed(2)}%`,
        orders: groupedOrders
      },
      totalRecord: totalGroups
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderDetails = async (token: any, query: any, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);

    const supplier = await supplierRepository.findOneBy({
      id: decoded.id,
      email: decoded.email.toLowerCase(),
      isDeleted: false,
    });

    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    const orderNumber = query.order_number;
    if (!orderNumber) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: "Order number is required",
        })
      );
    }

    const limit = Number(query.limit) || 20;
    const page = Number(query.page) || 1;
    const skip = (page - 1) * limit;

    const orderRepository = AppDataSource.getRepository(PurchaseOrders);

    const supplierCodes = Array.isArray(supplier.supplier_code)
      ? supplier.supplier_code
      : [supplier.supplier_code];

    const totalCount = await orderRepository.count({
      where: {
        order_number: orderNumber,
        isDeleted: false,
        supplier_code: In(supplierCodes),
      },
    });

    const records = await orderRepository.find({
      where: {
        order_number: orderNumber,
        isDeleted: false,
        supplier_code: In(supplierCodes),
      },
      order: {
        createdAt: "DESC",
      },
      skip,
      take: limit,
    });

    if (!records.length) {
      return CommonUtilities.sendResponsData({
        code: 404,
        message: `No records found for order number: ${orderNumber}`,
        data: [],
      });
    }

    // Transform line items
    const lineItems = records.map((r, index) => {
      // Debug logging with index to track records
      // const isOnTime =
      //   (r.quantity_arrived !== null && r.quantity_arrived >= r.ordered_quantity) &&
      //   (r.arrivalDate && r.arrivalDate <= r.requested_date);
      // const deliveryStatus = isOnTime ? "In tempo" : "Tardi";
      const now = new Date();
      let deliveryStatus = "Tardi";

      if (r.arrivalDate && r.quantity_arrived !== null && r.quantity_arrived >= r.ordered_quantity && r.arrivalDate <= r.requested_date) {
        deliveryStatus = "In tempo";
      } else if (!r.arrivalDate && r.requested_date && new Date(r.requested_date) > now) {
        deliveryStatus = "ordine da evadere";
      }

      console.log(`Record ${index} - deliveryStatus for ${r.article_code}: ${deliveryStatus}`);


      return {
        article_code: r.article_code,
        ordered_quantity: r.ordered_quantity,
        unit_price: r.unit_price,
        currency: r.currency,
        production_lot: r.production_lot,
        quantity_arrived: r.quantity_arrived,
        arrivalDate: r.arrivalDate,
        requested_date: r.requested_date,
        status: r.status || "Open",
        deliveryStatus: deliveryStatus,
      };
    });

    // Header summary
    const allOnTime = lineItems.every((item) => item.deliveryStatus === "In tempo");
    const orderSummary = {
      order_number: orderNumber,
      deliveryStatus: allOnTime ? "In tempo" : "Tardi",
      orderStatus: null,
    };

    return CommonUtilities.sendResponsData({
      code: 200,
      message: `Details fetched for order number: ${orderNumber}`,
      data: {
        summary: orderSummary,
        items: lineItems,
      },
      totalRecord: totalCount,
      currentPage: page,
      pageSize: limit,
    });

  } catch (error) {
    next(error);
  }
};