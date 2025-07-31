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

export const getInvoices = async (token: any, queryData: any, res: Response, next: NextFunction) => {
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
    const limit = Number(queryData?.limit) || 10;
    const page = Number(queryData?.page) || 1;
    const search = (queryData?.search || "").trim().toLowerCase();

    const fromDate = queryData?.fromDate ? new Date(queryData.fromDate) : null;
    const toDate = queryData?.toDate ? new Date(queryData.toDate) : null;

    // search
    const queryBuilder = invoiceRepository
      .createQueryBuilder("invoice")
      .leftJoin("invoice.supplier", "supplier")
      .where("supplier.id = :supplierId", { supplierId: supplier.id })
      .andWhere("invoice.isDeleted = false");

    if (search) {
      queryBuilder.andWhere(new Brackets(qb => {
        qb.where("LOWER(invoice.invoice_number) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.order_number) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.article_code) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.supplier_code) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.description) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(invoice.production_lot) LIKE :search", { search: `%${search}%` });
      }));
    }

    // date filter
    if (fromDate && toDate) {
      queryBuilder.andWhere("invoice.invoice_date BETWEEN :fromDate AND :toDate", {
        fromDate,
        toDate,
      });
    } else if (fromDate) {
      queryBuilder.andWhere("invoice.invoice_date >= :fromDate", { fromDate });
    } else if (toDate) {
      queryBuilder.andWhere("invoice.invoice_date <= :toDate", { toDate });
    }

    //  pagination & ordering
    queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy("invoice.insertion_date", "DESC");

    const [invoices, total] = await queryBuilder.getManyAndCount();

    return res.status(200).json(CommonUtilities.sendResponsData({
      code: 200,
      message: "Invoices fetched successfully",
      data: invoices,
      totalRecord: total,
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
      const rowErrors: any[] = [];

      // Validate supplier code

      // if (decoded.supplier_code !== row.supplier_code) {
      //   rowErrors.push({
      //     reason: "Mancata corrispondenza del codice fornitore",
      //     key: "supplier_code",
      //     value: row.supplier_code,
      //   });
      // }

      const matchedPO = existingPOs.find(po =>
        po.order_number === String(row.order_number)
      );

      if (!matchedPO) {
        rowErrors.push({
          reason: "Nessun ordine di acquisto corrispondente",
          key: "order_number",
          value: row.order_number,
        });
      } else {

        if (matchedPO.article_code !== String(row.article_code)) {
          rowErrors.push({
            reason: "Mancata corrispondenza del codice articolo",
            key: "article_code",
            value: row.article_code,
          });
        }

        // if (Number(matchedPO.ordered_quantity) !== Number(row.quantity)) {
        //   rowErrors.push({
        //     reason: "Mancata corrispondenza della quantità",
        //     key: "quantity",
        //     value: row.quantity,
        //   });
        // }

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
        supplier_code: supplier.supplier_code,
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
        supplier_code: supplier.supplier_code,
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

    return res.status(200).json(CommonUtilities.sendResponsData({
      code: 200,
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

//  delete Invoice by id  //

export const deleteInvoiceById = async (token: any, params: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);
    const invoice: any = await invoiceRepository.findOneBy({ id: params.id, isDeleted: false });
    if (!invoice) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVENTORY_NOT_EXISTS,
      }));
    }
    invoice.isDeleted = true;
    const data = await invoiceRepository.save(invoice);

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
export const updateInvoiceById = async (token: any, invoiceId: number, updatedData: any, res: Response, next: NextFunction) => {
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

    const invoice = await invoiceRepo.findOne({
      where: {
        id: invoiceId,
        supplier: { id: supplier.id },
        isDeleted: false,
      },
      relations: ["supplier"],
    });

    if (!invoice) {
      return res.status(404).json(CommonUtilities.sendResponsData({
        code: 404,
        message: "Fattura non trovata",
      }));
    }

    const matchedPO = await poRepo.findOneBy({
      order_number: String(updatedData.order_number),
      supplier_code: supplier.supplier_code,
    });

    const rowErrors: any[] = [];

    if (!matchedPO) {
      rowErrors.push({
        reason: "Nessun ordine di acquisto corrispondente",
        key: "order_number",
        value: updatedData.order_number,
      });
    } else {
      if (matchedPO.article_code !== String(updatedData.article_code)) {
        rowErrors.push({
          reason: "Mancata corrispondenza del codice articolo",
          key: "article_code",
          value: updatedData.article_code,
        });
      }

      const orderedQty = Number(matchedPO.ordered_quantity);
      const uploadedQty = Number(updatedData.quantity);
      const maxAllowedQty = orderedQty * 1.1;

      if (uploadedQty > maxAllowedQty) {
        rowErrors.push({
          reason: `La quantità supera il limite massimo consentito del 10% (Ordine: ${orderedQty}, Massimo consentito: ${Math.floor(maxAllowedQty)})`,
          key: "quantity",
          value: updatedData.quantity,
        });
      }

      if (Number(matchedPO.unit_price) !== Number(updatedData.price)) {
        rowErrors.push({
          reason: "Mancata corrispondenza del prezzo unitario",
          key: "price",
          value: updatedData.price,
        });
      }
    }

    if (rowErrors.length > 0) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: "Validation failed",
        data: rowErrors,
      }));
    }

    Object.assign(invoice, {
      invoice_number: updatedData.invoice_number,
      invoice_date: parseDate(updatedData.invoice_date),
      order_number: updatedData.order_number,
      article_code: updatedData.article_code,
      quantity: updatedData.quantity,
      price: updatedData.price,
      currency: updatedData.currency,
      description: updatedData.description,
      expected_delivery_date: parseDate(updatedData.expected_delivery_date),
      production_lot: updatedData.production_lot,
      processed: "true",
      insertion_date: new Date(),
    });

    await invoiceRepo.save(invoice);

    return res.status(200).json(CommonUtilities.sendResponsData({
      code: 200,
      message: "Fattura aggiornata con successo",
      data: invoice,
    }));
  } catch (error) {
    next(error);
  }
};



