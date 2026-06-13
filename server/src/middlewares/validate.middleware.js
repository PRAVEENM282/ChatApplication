import { ZodError } from "zod";

/**
 * Middleware to validate request body against a Zod schema.
 */
export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: err.errors.map((e) => `${e.path[e.path.length - 1]}: ${e.message}`).join(", "),
        errors: err.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }
    next(err);
  }
};
