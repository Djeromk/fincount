export interface Category {
	id: string;
	userId: string;
	name: string;
	color: string;
	type: 'income' | 'expense';
	isDefault: boolean;
  }
