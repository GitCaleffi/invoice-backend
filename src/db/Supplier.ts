import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: "" })
  username: string;

  @Column({ default: "" })
  email: string;

  @Column({ default: "" })
  password: string;

  @Column({ default: "" })
  supplier_code: string;

  @Column({ default: "" })
  rag_soc: string;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ default: "" })
  accessToken: string;

  @Column({ default: 0 })
  otp: number;

  @Column({ default: false })
  otpVerified: boolean;

  @Column({ type: "timestamp", nullable: true })
  otpExipredAt: Date;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt: Date;
}
