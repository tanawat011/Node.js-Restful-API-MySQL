import { lookupRoutes } from '../../lib/lookup.js';

export default (pool) => lookupRoutes(pool, 'ir_accessories', {
  name: { type: 'string', required: true },
});
