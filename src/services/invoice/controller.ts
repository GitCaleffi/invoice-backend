import { Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { InvoicesReceived } from '../../db/InvoicesReceived';
import { Brackets } from 'typeorm';


//  get Invoice list  //
export const getInvoice = async (token: any, queryData: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase() });
    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const inventoryRepository = AppDataSource.getRepository(InvoicesReceived);
    const limit = queryData?.limit || 10;
    const page = queryData?.page || 1;
    const search = (queryData?.search || "").trim().toLowerCase();

    const queryBuilder = inventoryRepository
      .createQueryBuilder("inventory")
      .leftJoin("inventory.supplier", "supplier")
      .where("supplier.id = :supplierId", { supplierId: decoded.id })
      .andWhere("inventory.isDeleted = false");

    if (search) {
      queryBuilder.andWhere(
        new Brackets(qb => {
          qb.where("LOWER(inventory.ean) LIKE :search", { search: `%${search}%` })
            .orWhere("CAST(inventory.sku AS TEXT) LIKE :search", { search: `%${search}%` })
        })
      );
    }

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy("inventory.updatedAt", "DESC");

    const [inventoryList, total] = await queryBuilder.getManyAndCount();

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.SUCCESS,
      data: inventoryList,
      totalRecord: total,
    });
  } catch (error) {
    next(error)
  }
};

//  upload Invoice CSV  //
export const uploadInvoiceCsv = async (token: any, bodyData: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase() });
    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const inventoryRepository = AppDataSource.getRepository(InvoicesReceived);

    for (const item of bodyData?.data) {
      const { sku, totalQuantity, prezzoVendita, costoArticoli, iva, ean, productTargetMargin } = item;

      // // Check if SKU exists for this supplier
      // let inventoryItem = await inventoryRepository.findOne({
      //   where: { sku, supplier: { id: decoded.id } },
      //   relations: ["supplier"], // Ensure supplier relation is loaded
      // });

      // if (inventoryItem) {
      //   inventoryItem.totalQuantity = totalQuantity;
      //   inventoryItem.prezzoVendita = prezzoVendita || '';
      //   inventoryItem.costoArticoli = costoArticoli || '';
      //   inventoryItem.iva = iva || '';
      //   inventoryItem.ean = ean;
      //   inventoryItem.productTargetMargin = productTargetMargin || 0;

      //   await inventoryRepository.save(inventoryItem);
      //   console.log(`Updated SKU: ${sku} for supplier: ${decoded.id}`);
      // }
      // else {
      //   inventoryItem = inventoryRepository.create({
      //     sku,
      //     totalQuantity,
      //     prezzoVendita: prezzoVendita || '',
      //     costoArticoli: costoArticoli || '',
      //     iva: iva || '',
      //     supplier,
      //     ean,
      //     productTargetMargin,
      //   });
      //   await inventoryRepository.save(inventoryItem);
      //   console.log(`Created new SKU: ${sku} for supplier: ${decoded.id}`);
      // }
    }

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.CSV_UPLOADED,
    });
  } catch (error) {
    next(error)
  }
};

//  download Invoice CSV  //
export const downloadInvoice = async (token: any, res: Response, next: NextFunction) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase() });
    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const inventoryRepository = AppDataSource.getRepository(InvoicesReceived);

    const inventoryList = await inventoryRepository.find({
      where: { supplier: { id: decoded.id } }, // Filter by supplierId
      order: { updatedAt: "DESC" }, // Sort by latest
    });

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.SUCCESS,
      data: inventoryList,
    });
  } catch (error) {
    next(error)
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

    const inventoryRepository = AppDataSource.getRepository(InvoicesReceived);
    const inventory: any = await inventoryRepository.findOneBy({ id: params.id, isDeleted: false });
    if (!inventory) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVENTORY_NOT_EXISTS,
      }));
    }
    inventory.isDeleted = true;
    const data = await inventoryRepository.save(inventory);

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.INVENTORY_DELETED,
    });
  }
  catch (error) {
    next(error)
  }
};

//  Get Invoice Details by id  //
export const getInvoiceDetails = async (token: any, params: any, res: Response, next: any) => {
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

    const inventoryRepository = AppDataSource.getRepository(InvoicesReceived);
    const inventory: any = await inventoryRepository.findOneBy({ id: params.id, isDeleted: false });
    if (!inventory) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVENTORY_NOT_EXISTS,
      }));
    }

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.INVENTORY_DETAILS,
      data: inventory
    });

  } catch (error) {
    next(error)
  }
};

//  Update Invoice  //
export const updateInvoice = async (token: any, bodyData: any, res: Response, next: any) => {
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

    const inventoryRepository = AppDataSource.getRepository(InvoicesReceived);
    const inventory: any = await inventoryRepository.findOneBy({ id: bodyData.id, isDeleted: false });
    if (!inventory) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVENTORY_NOT_EXISTS,
      }));
    }

    inventory.sku = bodyData.sku;
    inventory.ean = bodyData.ean;
    inventory.totalQuantity = bodyData.totalQuantity;
    inventory.prezzoVendita = bodyData.prezzoVendita;
    inventory.costoArticoli = bodyData.costoArticoli;
    inventory.iva = bodyData.iva;
    inventory.productTargetMargin = bodyData.productTargetMargin;

    await inventoryRepository.save(inventory);

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.INVENTORY_UPDATED,
      data: inventory
    });
  } catch (error) {
    next(error)
  }
};
