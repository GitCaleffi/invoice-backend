import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from "typeorm";
import { Supplier } from "./Supplier";

@Entity()
export class PurchaseOrders {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_number: string;

  @Column()
  article_code: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  requested_date: Date;

  @Column({ default: 0 })
  ordered_quantity: number;

  @Column({ type: "double precision", default: 0 })
  unit_price: number;

  @Column()
  supplier_code: string;

  @Column({ nullable: true })
  production_lot: string;

  @Column({ nullable: true })
  currency: string;

  @Column({ type: "timestamp", nullable: true })
  arrivalDate: Date;

  @Column({ default: 0 })
  quantity_arrived: number;

  @Column({ default: false })
  isDeleted: boolean;

  @ManyToOne(() => Supplier, { onDelete: "CASCADE" })
  supplier: Supplier; // This will create a `supplierId` column in the database.

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt: Date;
}
