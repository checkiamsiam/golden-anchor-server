"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = __importDefault(require("express"));
const authorization_middleware_1 = __importDefault(require("../../middleware/authorization.middleware"));
const validateRequest_middleware_1 = __importDefault(require("../../middleware/validateRequest.middleware"));
const user_controller_1 = __importDefault(require("./user.controller"));
const user_validation_1 = __importDefault(require("./user.validation"));
const userRoutes = express_1.default.Router();
userRoutes.get("/profile", (0, authorization_middleware_1.default)(client_1.UserRole.admin, client_1.UserRole.customer), user_controller_1.default.profile);
userRoutes.post("/create-customer", (0, authorization_middleware_1.default)(client_1.UserRole.admin), (0, validateRequest_middleware_1.default)(user_validation_1.default.createCustomerReq), user_controller_1.default.createCustomer);
userRoutes.post("/create-admin", (0, authorization_middleware_1.default)(client_1.UserRole.admin), (0, validateRequest_middleware_1.default)(user_validation_1.default.createAdminReq), user_controller_1.default.createAdmin);
exports.default = userRoutes;
