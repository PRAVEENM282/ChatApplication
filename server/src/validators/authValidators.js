import Joi from 'joi';
import { createValidator } from 'express-joi-validation';

const validator = createValidator();

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, lowercase letter, number, and special character'
    }),
  publicKey: Joi.string().required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const validateRegister = validator.body(registerSchema);
export const validateLogin = validator.body(loginSchema);
