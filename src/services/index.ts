import authRoutes from './auth/routes';
import orderRoutes from './order/routes';
import invoiceRoutes from './invoice/routes';
import invoiceMappingRoutes from './invoice-mapping/routes';


export default [
    ...authRoutes,
    ...orderRoutes,
    ...invoiceRoutes,
    ...invoiceMappingRoutes
];
