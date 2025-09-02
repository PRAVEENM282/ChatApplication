import Joi from 'joi';
import { createValidator } from 'express-joi-validation';

const validator = createValidator({ passError: true }); // Pass errors to our global handler

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
    .messages({
      'string.min': 'Password must be at least 8 characters long.'
    }),
  publicKey: Joi.string().required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// We pass the Joi options to show more helpful error messages
const joiOpts = {
  joi: {
    abortEarly: false, // Show all errors, not just the first
  }
};

export const validateRegister = validator.body(registerSchema, joiOpts);
export const validateLogin = validator.body(loginSchema, joiOpts);
