'use strict';

/** Hard-refuse destructive/seed scripts in production. */
function assertNotProd(label = 'operation') {
  if (process.env.NODE_ENV === 'production') {
    console.error(`Refusing ${label}: NODE_ENV=production`);
    process.exit(1);
  }
}

module.exports = { assertNotProd };
