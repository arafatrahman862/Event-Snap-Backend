import axios from "axios";
import httpStatus from "http-status-codes";
import { ISSLCommerz } from "./sslCommerz.interface";
import config from "../../../config";
import ApiError from "../../errors/ApiError";

interface SSLValidationPayload {
  val_id: string;
  [key: string]: any;
}

interface SSLPaymentData {
  store_id: string;
  store_passwd: string;
  total_amount: number;
  currency: string;
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url: string;
  shipping_method: string;
  product_name: string;
  product_category: string;
  product_profile: string;
  cus_name: string;
  cus_email: string;
  cus_add1: string;
  cus_add2: string;
  cus_city: string;
  cus_state: string;
  cus_postcode: string;
  cus_country: string;
  cus_phone: string;
  cus_fax: string;
  ship_name: string;
  ship_add1: string;
  ship_add2: string;
  ship_city: string;
  ship_state: string;
  ship_postcode: number;
  ship_country: string;
}

const sslPaymentInit = async (payload: ISSLCommerz) => {
  try {
    const data: SSLPaymentData = {
      store_id: config.ssl.store_id,
      store_passwd: config.ssl.store_pass,
      total_amount: payload.amount,
      currency: "BDT",
      tran_id: payload.transactionId,
      success_url: `${config.ssl.success_backend_url}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=success`,
      fail_url: `${config.ssl.fail_backend_url}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=fail`,
      cancel_url: `${config.ssl.cancel_backend_url}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=cancel`,
      ipn_url: config.ssl.ipn_url,
      shipping_method: "N/A",
      product_name: "Event",
      product_category: "Service",
      product_profile: "general",
      cus_name: payload.name,
      cus_email: payload.email,
      cus_add1: payload.address,
      cus_add2: "N/A",
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: payload.phoneNumber,
      cus_fax: "01711111111",
      ship_name: "N/A",
      ship_add1: "N/A",
      ship_add2: "N/A",
      ship_city: "N/A",
      ship_state: "N/A",
      ship_postcode: 1000,
      ship_country: "N/A",
    };

    const response = await axios({
      method: "POST",
      url: config.ssl.payment_api,
      data: data,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return response.data;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Payment initialization failed";
    throw new ApiError(httpStatus.BAD_REQUEST, errorMessage);
  }
};

const validatePayment = async (payload: SSLValidationPayload) => {
  try {
    const response = await axios({
      method: "GET",
      url: `${config.ssl.validation_api}?val_id=${payload.val_id}&store_id=${config.ssl.store_id}&store_passwd=${config.ssl.store_pass}`,
    });

    return response.data;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Payment validation failed";
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      `Payment Validation Error: ${errorMessage}`
    );
  }
};

export const SSLService = {
  sslPaymentInit,
  validatePayment,
};
