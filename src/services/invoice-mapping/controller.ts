import { Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { InvoicesReceived } from '../../db/InvoicesReceived';
import { Brackets, In } from 'typeorm';
import { SupplierInvoicesMapping } from '../../db/SupplierInvoiceMapping';
import { PurchaseOrders } from '../../db/PurchaseOrders';
import { HTTP400Error } from '../../utils/httpErrors';

const parseDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return undefined;
  return new Date(`${year}-${month}-${day}`);
};

const supplierRepository = AppDataSource.getRepository(Supplier);
const headerMappingRepo = AppDataSource.getRepository(SupplierInvoicesMapping);
const poRepo = AppDataSource.getRepository(PurchaseOrders);
const invoiceRepo = AppDataSource.getRepository(InvoicesReceived);


//  get Invoice Mapping list  //
export const getInvoices = async (token: any, queryData: any, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    const limit = queryData?.limit || 10;
    const page = queryData?.page || 1;
    const search = (queryData?.search || "").trim().toLowerCase();

    const invoices = await invoiceRepo.find({
      where: {
        supplier: { id: supplier.id },
        isDeleted: false
      },
      relations: ["supplier"],
      order: { insertion_date: "DESC" }
    });

    return CommonUtilities.sendResponsData({
      code: 200,
      message: "Invoices fetched successfully",
      data: invoices,
    });
  }
  catch (error) {
    next(error);
  }
};

export const uploadInvoiceCsv = async (token: any, bodyData: any, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    if (!Array.isArray(bodyData)) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: "Invalid data format: expected an array",
        })
      );
    }

    const existingPOs = await poRepo.find({
      where: { supplier_code: In(supplier.supplier_code) },
    });
    if (!existingPOs || existingPOs.length === 0) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: "Nessun ordine di acquisto trovato",
        })
      );
    }

    const validRows: any[] = [];
    const invalidRows: any[] = [];

    for (let index = 0; index < bodyData.length; index++) {
      const row = bodyData[index];
      const rowIndex = index + 1;
      const rowErrors: any[] = [];

      const matchedPO = existingPOs.find(po =>
        po.order_number === String(row.order_number)
      );

      if (!matchedPO) {
        rowErrors.push({
          reason: "Nessun ordine di acquisto corrispondente",
          key: "order_number",
          value: row.order_number,
        });
      }
      else {
        if (matchedPO.article_code !== String(row.article_code)) {
          rowErrors.push({
            reason: "Mancata corrispondenza del codice articolo",
            key: "article_code",
            value: row.article_code,
          });
        }

        const orderedQty = Number(matchedPO.ordered_quantity);
        const uploadedQty = Number(row.quantity);
        const maxAllowedQty = orderedQty * 1.1;

        if (uploadedQty > maxAllowedQty) {
          rowErrors.push({
            reason: `La quantità supera il limite massimo consentito del 10% (Ordine: ${orderedQty}, Massimo consentito: ${maxAllowedQty.toFixed(2)})`,
            key: "quantity",
            value: row.quantity,
          });
        }

        if (Number(matchedPO.unit_price) !== Number(row.price)) {
          rowErrors.push({
            reason: "Mancata corrispondenza del prezzo unitario",
            key: "price",
            value: row.price,
          });
        }
      }

      if (rowErrors.length > 0) {
        invalidRows.push({
          row: rowIndex,
          errors: rowErrors
        });
        continue;
      }

      validRows.push({
        ...row,
        supplier_code: matchedPO?.supplier_code,
        processed: "true",
        insertion_date: new Date(),
      });
    }

    for (const item of validRows) {
      const invoice_number_str = String(item.invoice_number);

      let existingInvoice = await invoiceRepo.findOne({
        where: {
          invoice_number: invoice_number_str,
          order_number: item.order_number,
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
        supplier_code: item.supplier_code,
        production_lot: item.production_lot || '',
        processed: item.processed || '',
        insertion_date: item.insertion_date || new Date(),
        supplier: supplier,
      };

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

    return CommonUtilities.sendResponsData({
      code: 200,
      message: validRows.length > 0 ? `${validRows.length} row(s) uploaded successfully.` : "No valid rows uploaded.",
      data: {
        inserted: validRows.length,
        failed: invalidRows.length,
        invalidRows,
      },
    });
  }
  catch (error) {
    console.error("Upload error:", error);
    next(error);
  }
};

//  add mapped headers  //
export const addMappedHeaders = async (token: any, bodyData: any, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
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
    }
    else {
      const newMapping = headerMappingRepo.create({
        ...mapping,
        supplier: supplier,
      });

      await headerMappingRepo.save(newMapping);
    }

    return CommonUtilities.sendResponsData({
      code: 200,
      message: "Header mapping saved successfully",
    });
  }
  catch (error) {
    next(error);
  }
};

//  get headers api   //
export const getInvoicesHeaders = async (token: any, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    const existingMapping = await headerMappingRepo.findOne({
      where: { supplier: { id: supplier.id } },
      relations: ["supplier"],
    });

    return CommonUtilities.sendResponsData({
      code: 200,
      message: "Headers mapping fetched successfully",
      data: existingMapping || {},
    });
  }
  catch (error) {
    next(error);
  }
};
