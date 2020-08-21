import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const product_ids = products.map(product => {
      return { id: product.id };
    });

    const productsObjectsList = await this.productsRepository.findAllById(
      product_ids,
    );

    if (!productsObjectsList.length) {
      throw new AppError('Could not found any products with the given ids');
    }

    const existentProductsIds = productsObjectsList.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not found the product: ${checkInexistentProducts[0].id}`,
      );
    }

    const findProductWithNoQuantityAvaible = products.filter(
      product =>
        productsObjectsList.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductWithNoQuantityAvaible.length) {
      throw new AppError(
        `The quantity: ${findProductWithNoQuantityAvaible[0].quantity} is not available for ${findProductWithNoQuantityAvaible[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsObjectsList.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsObjectsList.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
