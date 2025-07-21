import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Supplier } from "./Supplier";

@Entity()
export class InvoicesReceived  {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: "" })
  invoice_number: string;

  @Column({ type: "timestamp", nullable:true })
  invoice_date: Date;

  @Column({ default: "" })
  order_number: string;

  @Column({ default: "" })
  article_code: string;

  @Column({ default: 0 })
  quantity: number;

  @Column({ default: 0 })
  price: number;

  @Column()
  currency: string;

  @Column()
  description: string;

  @Column({ type: "timestamp" ,  nullable:true})
  expected_delivery_date: Date;

  @Column()
  supplier_code: string;

  @Column()
  production_lot: string;

  @Column()
  processed: string;

  @Column({ type: "timestamp", nullable:true })
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
