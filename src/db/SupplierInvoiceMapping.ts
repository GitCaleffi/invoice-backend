import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from "typeorm";
import { Supplier } from "./Supplier";

@Entity()
export class SupplierInvoicesMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  invoice_number: string;

  @Column({ nullable: true })
  invoice_date: string;

  @Column({ nullable: true })
  order_number: string;

  @Column({ nullable: true })
  article_code: string;

  @Column({ nullable: true })
  quantity: string;

  @Column({ nullable: true })
  price: string;

  @Column({ nullable: true })
  currency: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  expected_delivery_date: string;

  // @Column({ nullable: true })
  // supplier_code: string;

  @Column({ nullable: true })
  production_lot: string;

  @Column({ nullable: true })
  processed: string;

  @Column({ nullable: true })
  insertion_date: string;

  @Column({ default: false })
  isDeleted: boolean;

  @OneToOne(() => Supplier, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supplierId" })
  supplier: Supplier;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt: Date;

}
