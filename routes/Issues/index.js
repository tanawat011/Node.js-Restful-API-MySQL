import { lookupRoutes } from '../../lib/lookup.js';

export default (pool) => lookupRoutes(pool, 'ir_issues', {
  name: { type: 'string', required: true },
});
