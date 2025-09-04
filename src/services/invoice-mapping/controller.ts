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
const exceedPercentage = parseFloat(process.env.EXCEED_PERCENTAGE || "1.25"); 

//  get Invoice Mapping list  //
export const getInvoices = async (token: any, queryData: any, next: NextFunction) => {
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

    const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);
    const limit = Number(queryData?.limit) || 10;
    const page = Number(queryData?.page) || 1;
    const search = (queryData?.search || "").trim().toLowerCase();
    const fromDate = queryData?.fromDate ? new Date(queryData.fromDate) : null;
    const toDate = queryData?.toDate ? new Date(queryData.toDate) : null;

    const baseQuery = invoiceRepository
      .createQueryBuilder("invoice")
      .select("invoice.invoice_number", "invoice_number")
      .addSelect("COUNT(invoice.id)", "item_count")
      .addSelect("SUM(invoice.quantity)", "total_quantity")
      .addSelect("SUM(invoice.quantity * invoice.price)", "total_invoiced")
      .addSelect("MAX(invoice.insertion_date)", "latest_insertion_date")
      .leftJoin("invoice.supplier", "supplier")
      .where("supplier.id = :supplierId", { supplierId: supplier.id })
      .andWhere("invoice.isDeleted = false");

    // Filters
    if (search) {
      baseQuery.andWhere(new Brackets(qb => {
        qb.where("LOWER(invoice.invoice_number) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.order_number) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.article_code) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.supplier_code) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.description) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.production_lot) LIKE :search", { search: `%${search}%` });
      }));
    }

    if (fromDate && toDate) {
      baseQuery.andWhere("invoice.invoice_date BETWEEN :fromDate AND :toDate", { fromDate, toDate });
    } else if (fromDate) {
      baseQuery.andWhere("invoice.invoice_date >= :fromDate", { fromDate });
    } else if (toDate) {
      baseQuery.andWhere("invoice.invoice_date <= :toDate", { toDate });
    }

    baseQuery.groupBy("invoice.invoice_number");

    const countQuery = AppDataSource
      .createQueryBuilder()
      .select("COUNT(*)", "count")
      .from("(" + baseQuery.getQuery() + ")", "grouped_invoices")
      .setParameters(baseQuery.getParameters());

    const countResult = await countQuery.getRawOne();
    const totalCount = Number(countResult.count || 0);

    // Pagination and ordering
    baseQuery
      .orderBy("MAX(invoice.insertion_date)", "DESC")
      .offset((page - 1) * limit)
      .limit(limit);

    const invoices = await baseQuery.getRawMany();

    return CommonUtilities.sendResponsData({
      code: 200,
      message: "Grouped invoices fetched successfully",
      data: invoices,
      totalRecord: totalCount,
    });

  } catch (error) {
    next(error);
  }
};

// details
export const getInvoiceDetails = async (token: any, query: any, next: NextFunction) => {
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

    const invoiceNumber = query.invoice_number;
    if (!invoiceNumber) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: "Invoice number is required",
        })
      );
    }

    // Pagination values
    const limit = Number(query.limit) || 10;
    const page = Number(query.page) || 1;
    const offset = (page - 1) * limit;

    const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);

    // Get total count
    const totalCount = await invoiceRepository.count({
      where: {
        invoice_number: invoiceNumber,
        isDeleted: false,
        supplier: { id: supplier.id },
      },
    });

    // Get paginated data
    const records = await invoiceRepository.find({
      where: {
        invoice_number: invoiceNumber,
        isDeleted: false,
        supplier: { id: supplier.id },
      },
      order: {
        insertion_date: "DESC",
      },
      skip: offset,
      take: limit,
    });

    return CommonUtilities.sendResponsData({
      code: 200,
      message: `Records fetched for invoice number: ${invoiceNumber}`,
      data: records,
      totalRecord: totalCount,
      currentPage: page,
      pageSize: limit,
    });

  } catch (error) {
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

    if (!existingPOs || (existingPOs.length === 0)) {
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
        po.order_number === String(row.order_number) &&
        po.article_code === String(row.article_code)
      );

      if (!matchedPO) {
        rowErrors.push({
          reason: "Nessun ordine di acquisto corrispondente",
          key: "order_number",
          value: row.order_number,
          order_number: row.order_number,
          article_code: row.article_code
        });
      }
      else {
        if (matchedPO.article_code != String(row.article_code)) {
          rowErrors.push({
            reason: "Mancata corrispondenza del codice articolo",
            key: "article_code",
            value: row.article_code,
            order_number: row.order_number,
            article_code: row.article_code

          });
        }

        const orderedQty = Number(matchedPO.ordered_quantity);
        const uploadedQty = Number(row.quantity);
        const maxAllowedQty = orderedQty * exceedPercentage;

        if (uploadedQty > maxAllowedQty) {
          rowErrors.push({
            reason: `La quantità supera il limite massimo consentito del 25% (Ordine: ${orderedQty}, Massimo consentito: ${maxAllowedQty.toFixed(2)})`,
            key: "quantity",
            value: row.quantity,
            order_number: row.order_number,
            article_code: row.article_code
          });
        }

        if (Number(matchedPO.unit_price) !== Number(row.price)) {
          rowErrors.push({
            reason: "Mancata corrispondenza del prezzo unitario",
            key: "price",
            value: row.price,
            order_number: row.order_number,
            article_code: row.article_code

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

    // If there are any invalid rows, return early without saving to the database

    if (invalidRows?.length > 0) {
      return CommonUtilities.sendResponsData({
        code: 400,
        message: "Some rows contain errors. No data was saved.",
        data: {
          inserted: 0,
          failed: invalidRows.length,
          invalidRows,
        },
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
        expected_delivery_date: item.expected_delivery_date ? parseDate(item.expected_delivery_date) : item.expected_delivery_date,
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

//  delete Invoice by id  //
export const deleteInvoiceById = async (token: any, params: any, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    const invoice: any = await invoiceRepo.findOneBy({ id: params.id, isDeleted: false });
    if (!invoice) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.INVENTORY_NOT_EXISTS,
        })
      );
    }
    invoice.isDeleted = true;
    const data = await invoiceRepo.save(invoice);

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.INVENTORY_DELETED,
    });
  }
  catch (error) {
    next(error)
  }
};

//  Update Invoice  //

export const updateInvoiceById = async (
  token: any,
  invoiceId: number,
  updatedData: any,
  res: Response,
  next: NextFunction
) => {
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

    const invoice = await invoiceRepo.findOne({
      where: { id: invoiceId, supplier: { id: supplier.id }, isDeleted: false },
      relations: ["supplier"],
    });

    if (!invoice) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: "Invoice not found",
        })
      );
    }

    const immutableFields = ["invoice_number", "order_number", "article_code"];
    for (const field of immutableFields) {
      if (
        updatedData.hasOwnProperty(field) &&
        String(updatedData[field]) !== String((invoice as any)[field])
      ) {
        throw new HTTP400Error(
          CommonUtilities.sendResponsData({
            code: 400,
            message: `Field '${field}' is not editable.`,
          })
        );
      }
    }

    Object.assign(invoice, {
      quantity: updatedData.quantity ?? invoice.quantity,
      price: updatedData.price ?? invoice.price,
      currency: updatedData.currency ?? invoice.currency,
      description: updatedData.description ?? invoice.description,
      expected_delivery_date: updatedData.expected_delivery_date
        ? new Date(updatedData.expected_delivery_date)
        : invoice.expected_delivery_date,
      invoice_date: updatedData.invoice_date
        ? new Date(updatedData.invoice_date)
        : invoice.invoice_date,

      production_lot: updatedData.production_lot ?? invoice.production_lot,
      processed: true,
      insertion_date: new Date(),
    });

    const updatedInvoice = await invoiceRepo.save(invoice);

    return res.status(200).json(
      CommonUtilities.sendResponsData({
        code: 200,
        message: "Invoice updated successfully",
        data: updatedInvoice,
      })
    );
  } catch (err) {
    console.error("Invoice update error:", err);
    next(err);
  }
};





