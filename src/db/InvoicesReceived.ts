import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Supplier } from "./Supplier";

@Entity()
export class InvoicesReceived {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  invoice_number: string;

  @Column({ type: "timestamp", nullable: true })
  invoice_date: Date;

  @Column({ nullable: true })
  order_number: string;

  @Column({ nullable: true })
  article_code: string;

  @Column({ default: 0 })
  quantity: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ nullable: true })
  currency: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: "timestamp", nullable: true })
  expected_delivery_date: Date;

  // @Column()
  // supplier_code: string;

  @Column({ nullable: true })
  production_lot: string;

  @Column({ nullable: true })
  processed: string;

  @Column({ type: "timestamp", nullable: true })
  insertion_date: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @ManyToOne(() => Supplier, { onDelete: "CASCADE" })
  supplier: Supplier; // This will create a `supplierId` column in the database.

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt: Date;

}
