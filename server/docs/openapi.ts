import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import type { Express } from "express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: { title: "Skippy API", version: "1.0.0" },
  },
  apis: [],
};
const spec = swaggerJsdoc(options);
export function mountDocs(app: Express){
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
}
