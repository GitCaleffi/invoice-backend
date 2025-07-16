import authRoutes from './auth/routes';
import orderRoutes from './order/routes';
import invoiceRoutes from './invoice/routes';

export default [
    ...authRoutes,
    ...orderRoutes,
    ...invoiceRoutes,
];
