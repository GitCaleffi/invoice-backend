import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  supplier_code: string;

  @Column({ unique: true })
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
