import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from "typeorm";
import { Supplier } from "./Supplier";

@Entity()
export class SupplierInvoicesMapping  {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: null })
  invoice_number: string;

  @Column({ default: null  })
  invoice_date: string;

  @Column({  default: null})
  order_number: string;

  @Column({  default: null })
  article_code: string;

  @Column({ default: null  })
  quantity: string;

  @Column({ default: null  })
  price: string;

  @Column({ default: null})
  currency: string;

  @Column({ default: null})
  description: string;

  @Column({ default: null})
  expected_delivery_date: string;

  @Column({ default: null})
  supplier_code: string;

  @Column({ default: null})
  production_lot: string;

  @Column({ default: null})
  processed: string;

  @Column({ default: null})
  insertion_date: string;

  @Column({ default: false })
  isDeleted: boolean;

  @OneToOne(() => Supplier, { onDelete: "CASCADE" })
  @JoinColumn({name: "supplierId"}) 
  supplier: Supplier; 

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt: Date;

}
