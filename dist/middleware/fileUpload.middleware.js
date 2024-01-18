"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
const http_status_1 = __importDefault(require("http-status"));
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const config_1 = __importDefault(require("../config"));
const customError_util_1 = __importDefault(require("../utils/customError.util"));
cloudinary_1.v2.config({
    cloud_name: config_1.default.cloudinary.cloudName,
    api_key: config_1.default.cloudinary.apiKey,
    api_secret: config_1.default.cloudinary.apiSecret,
});
const makeStorage = (folder) => {
    return new multer_storage_cloudinary_1.CloudinaryStorage({
        cloudinary: cloudinary_1.v2,
        params: {
            public_id: (req, file) => `${folder}/` +
                Math.floor(Math.random() * 10) +
                Math.floor(Math.random() * 10) +
                file.originalname.split(" ").join("-"),
        },
    });
};
const uploadToCloudinary = (fieldName, folderToUpload, fileFilter, multiple = false) => {
    const upload = (0, multer_1.default)({
        storage: makeStorage(folderToUpload),
        limits: { fileSize: 1024 * 1024 * 5 },
        fileFilter: (req, file, cb) => {
            if (fileFilter.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                cb(new customError_util_1.default("Invalid File Format", http_status_1.default.BAD_REQUEST));
            }
        },
    });
    if (multiple)
        return upload.array(fieldName);
    return upload.single(fieldName);
};
exports.default = uploadToCloudinary;
