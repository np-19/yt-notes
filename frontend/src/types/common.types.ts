export type Nullable<T> = T | null;

export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
};
