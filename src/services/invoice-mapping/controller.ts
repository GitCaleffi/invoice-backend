import { Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { InvoicesReceived } from '../../db/InvoicesReceived';
import { Brackets } from 'typeorm';
import { SupplierInvoicesMapping } from '../../db/SupplierInvoiceMapping';

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
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({
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

    const invoiceRepository = AppDataSource.getRepository(InvoicesReceived);

    for (const item of bodyData) {
      const invoice_number_str = String(item.invoice_number);

      let invoiceItem = await invoiceRepository.findOne({
        where: {
          invoice_number: invoice_number_str,
          supplier: { id: decoded.id },
          isDeleted: false
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
        insertion_date: parseDate(item.insertion_date),
        supplier: supplier,
      };

      try {
        if (invoiceItem) {
          Object.assign(invoiceItem, invoiceData);
          await invoiceRepository.save(invoiceItem);
        } else {
          const newInvoice = invoiceRepository.create(invoiceData);
          await invoiceRepository.save(newInvoice);
        }
      } catch (err) {
        console.error(`Error saving invoice ${invoice_number_str}:`, err);
      }
    }

    return res.status(200).json(CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.CSV_UPLOADED,
    }));

  } catch (error) {
    console.error("Upload error:", error);
    next(error);
  }
};


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



