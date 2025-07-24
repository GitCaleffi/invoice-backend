import { Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { InvoicesReceived } from '../../db/InvoicesReceived';
import { Brackets } from 'typeorm';
import { SupplierInvoicesMapping } from '../../db/SupplierInvoiceMapping';
import { PurchaseOrders } from '../../db/PurchaseOrders';

const parseDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return undefined;
  return new Date(`${year}-${month}-${day}`);
};

//  get Invoice Mapping list  //
export const getInvoices = async (token: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);

    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier = await supplierRepository.findOneBy({
      id: decoded.id,
      email: decoded.email.toLowerCase(),
    });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);

    const invoices = await invoiceRepository.find({
      where: {
        supplier: { id: supplier.id },
        isDeleted: false
      },
      relations: ["supplier"],
      order: { insertion_date: "DESC" }
    });

    return res.status(200).json(CommonUtilities.sendResponsData({
      code: 200,
      message: "Invoices fetched successfully",
      data: invoices,
    }));
  } catch (error) {
    next(error);
  }
};


export const uploadInvoiceCsv = async (token: any, bodyData: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepo = AppDataSource.getRepository(Supplier);
    const poRepo = AppDataSource.getRepository(PurchaseOrders);
    const invoiceRepo = AppDataSource.getRepository(InvoicesReceived);

    const supplier = await supplierRepo.findOneBy({
      id: decoded.id,
      email: decoded.email.toLowerCase(),
    });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    if (!Array.isArray(bodyData)) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: "Invalid data format: expected an array",
      }));
    }

    const existingPOs = await poRepo.find({
      where: { supplier_code: supplier.supplier_code },
    });

    const validRows: any[] = [];
    const invalidRows: any[] = [];

    for (let index = 0; index < bodyData.length; index++) {
      const row = bodyData[index];
      const rowIndex = index + 1;

      if (decoded.supplier_code != row.supplier_code) {
        invalidRows.push({ row, reason: `Row ${rowIndex}: Invalid supplier code!` });
        continue;
      }

      const matchedPO = existingPOs.find(po =>
        po.order_number === String(row.order_number)
      );

      if (!matchedPO) {
        invalidRows.push({ row, reason: `Row ${rowIndex}: No matching PO with this order number for supplier.` });
        continue;
      }

      const errors = [];

      if (matchedPO.article_code !== String(row.article_code)) {
        errors.push("Article code mismatch");
      }

      if (matchedPO.supplier_code !== String(row.supplier_code)) {
        errors.push("Supplier code mismatch");
      }

      if (Number(matchedPO.ordered_quantity) !== Number(row.quantity)) {
        errors.push("Quantity mismatch");
      }

      if (Number(matchedPO.unit_price) !== Number(row.price)) {
        errors.push("Unit price mismatch");
      }

      if (errors.length > 0) {
        invalidRows.push({ row, reason: `Row ${rowIndex}: ${errors.join(", ")}` });
        continue;
      }

      validRows.push({
        ...row,
        processed: "true",
        insertion_date: new Date(),
      });
    }

    for (const item of validRows) {
      const invoice_number_str = String(item.invoice_number);

      let existingInvoice = await invoiceRepo.findOne({
        where: {
          invoice_number: invoice_number_str,
          supplier: { id: supplier.id },
          isDeleted: false,
        },
        relations: ["supplier"],
      });

      const invoiceData = {
        invoice_number: invoice_number_str,
        invoice_date: parseDate(item.invoice_date),
        order_number: item.order_number || '',
        article_code: item.article_code || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
        currency: item.currency || '',
        description: item.description || '',
        expected_delivery_date: parseDate(item.expected_delivery_date),
        supplier_code: item.supplier_code || '',
        production_lot: item.production_lot || '',
        processed: item.processed || '',
        insertion_date: item.insertion_date || new Date(),
        supplier: supplier,
      };
      console.log(invoiceData, "iiiiiiiiiiiiiiiiiiiii")

      try {
        if (existingInvoice) {
          Object.assign(existingInvoice, invoiceData);
          await invoiceRepo.save(existingInvoice);
        } else {
          const newInvoice = invoiceRepo.create(invoiceData);
          await invoiceRepo.save(newInvoice);
        }
      } catch (err) {
        console.error(`Error saving invoice ${invoice_number_str}:`, err);
      }
    }

    return res.status(200).json(CommonUtilities.sendResponsData({
      code: 200,
      // message: MESSAGES.CSV_UPLOADED,
      message: validRows.length > 0
        ? `${validRows.length} row(s) uploaded successfully.`
        : "No valid rows uploaded.",
      data: {
        inserted: validRows.length,
        failed: invalidRows.length,
        invalidRows,
      }
    }));

  } catch (error) {
    console.error("Upload error:", error);
    next(error);
  }
};

// export const uploadInvoiceCsv = async (token: any, bodyData: any, res: Response, next: NextFunction) => {
//   try {
//     const decoded: any = await CommonUtilities.getDecoded(token);
//     const supplierRepository = AppDataSource.getRepository(Supplier);
//     const supplier: any = await supplierRepository.findOneBy({
//       id: decoded.id,
//       email: decoded.email.toLowerCase(),
//     });

//     if (!supplier) {
//       return res.status(400).json(CommonUtilities.sendResponsData({
//         code: 400,
//         message: MESSAGES.USER_NOT_EXISTS,
//       }));
//     }

//     if (!Array.isArray(bodyData)) {
//       return res.status(400).json(CommonUtilities.sendResponsData({
//         code: 400,
//         message: "Invalid data format: expected an array",
//       }));
//     }

//     const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);

//     for (const item of bodyData) {
//       const invoice_number_str = String(item.invoice_number);

//       let invoiceItem = await invoiceRepository.findOne({
//         where: {
//           invoice_number: invoice_number_str,
//           supplier: { id: decoded.id },
//           isDeleted: false
//         },
//         relations: ["supplier"],
//       });

//       const invoiceData = {
//         invoice_number: invoice_number_str,
//         invoice_date: parseDate(item.invoice_date),
//         order_number: item.order_number || '',
//         article_code: item.article_code || '',
//         quantity: item.quantity || 0,
//         price: item.price || 0,
//         currency: item.currency || '',
//         description: item.description || '',
//         expected_delivery_date: parseDate(item.expected_delivery_date),
//         supplier_code: item.supplier_code || '',
//         production_lot: item.production_lot || '',
//         processed: item.processed || '',
//         insertion_date: parseDate(item.insertion_date),
//         supplier: supplier,
//       };

//       try {
//         if (invoiceItem) {
//           Object.assign(invoiceItem, invoiceData);
//           await invoiceRepository.save(invoiceItem);
//         } else {
//           const newInvoice = invoiceRepository.create(invoiceData);
//           await invoiceRepository.save(newInvoice);
//         }
//       } catch (err) {
//         console.error(`Error saving invoice ${invoice_number_str}:`, err);
//       }
//     }

//     return res.status(200).json(CommonUtilities.sendResponsData({
//       code: 200,
//       message: MESSAGES.CSV_UPLOADED,
//     }));

//   } catch (error) {
//     console.error("Upload error:", error);
//     next(error);
//   }
// };


// add headers
export const addMappedHeaders = async (
  token: any,
  bodyData: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const headerMappingRepo = AppDataSource.getRepository(SupplierInvoicesMapping);

    const supplier = await supplierRepository.findOneBy({
      id: decoded.id,
      email: decoded.email.toLowerCase(),
    });

    if (!supplier) {
      return res.status(400).json(
        CommonUtilities.sendResponsData({
          code: 400,
          message: "Supplier does not exist",
        })
      );
    }

    const mapping = bodyData;

    let existingMapping = await headerMappingRepo.findOne({
      where: { supplier: { id: supplier.id } },
      relations: ["supplier"],
    });

    if (existingMapping) {
      Object.keys(mapping).forEach((key) => {
        if (key in existingMapping) {
          (existingMapping as any)[key] = mapping[key];
        }
      });

      await headerMappingRepo.save(existingMapping);
    } else {
      const newMapping = headerMappingRepo.create({
        ...mapping,
        supplier: supplier,
      });

      await headerMappingRepo.save(newMapping);
    }

    return CommonUtilities.sendResponsData({
      res,
      code: 200,
      message: "Header mapping saved successfully",
    });
  } catch (error) {
    next(error);
  }
};

// get headers api

export const getInvoicesHeaders = async (
  token: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);

    const supplierRepository = AppDataSource.getRepository(Supplier);
    const headerMappingRepo = AppDataSource.getRepository(SupplierInvoicesMapping);

    const supplier = await supplierRepository.findOneBy({
      id: decoded.id,
      email: decoded.email.toLowerCase(),
    });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const existingMapping = await headerMappingRepo.findOne({
      where: { supplier: { id: supplier.id } },
      relations: ["supplier"],
    });

    return CommonUtilities.sendResponsData({
      res,
      code: 200,
      message: "Headers mapping fetched successfully",
      data: existingMapping || {},
    });
  } catch (error) {
    next(error);
  }
};



