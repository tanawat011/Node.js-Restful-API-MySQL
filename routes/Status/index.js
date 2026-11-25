import { lookupRoutes } from '../../lib/lookup.js';

export default (pool) => lookupRoutes(pool, 'ir_status', {
  name: { type: 'string', required: true },
  color: { type: 'string' },
});
