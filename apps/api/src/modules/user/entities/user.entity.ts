export class User {
  id!: string;
  username!: string;
  email!: string;
  passwordHash!: string;
  role!: 'admin' | 'user';
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
