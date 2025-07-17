import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: null })
  username: string;

  @Column({ default: null })
  email: string;

  @Column({ default: null })
  password: string;

  @Column({ default: null })
  supplier_code: string;

  @Column({ default: null })
  rag_soc: string;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ default: null })
  accessToken: string;

  @Column({ default: 0 })
  otp: number;

  @Column({ default: false })
  otpVerified: boolean;

  @Column({ type: "timestamp", nullable: true })
  otpExipredAt: Date;

  @Column({ default: false })
  accountVerified: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt: Date;
}
