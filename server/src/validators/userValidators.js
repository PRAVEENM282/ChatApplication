import Joi from 'joi';
import { createValidator } from 'express-joi-validation';

const validator = createValidator();

const searchSchema = Joi.object({
  q: Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9\s@._-]+$/).required()
    .messages({
      'string.pattern.base': 'Search query contains invalid characters'
    })
});

export const validateSearch = validator.query(searchSchema);
