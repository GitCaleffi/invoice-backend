import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ type: "simple-json", nullable: true })
  supplier_code: string[];

  @Column({ nullable: true })
  rag_soc: string;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
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
