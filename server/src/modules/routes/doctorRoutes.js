const express = require("express");
const router = express.Router();
const doctorController = require("../doctors/doctorController");

//  ADD: Import authentication middleware
const { 
  authenticateToken, 
  authorizeWithAuditCheck
} = require("../middleware/auth");


//  UPDATED: Doctor CRUD with audit restrictions
router.get("/", authenticateToken, doctorController.getDoctors);
router.post("/", authenticateToken, authorizeWithAuditCheck, doctorController.addDoctor);
router.put("/:id", authenticateToken, authorizeWithAuditCheck, doctorController.updateDoctor);
router.delete("/:id", authenticateToken, authorizeWithAuditCheck, doctorController.deleteDoctor);

//  UPDATED: Doctor sales mapping (read-only for audit)
router.get("/:id/sales", authenticateToken, doctorController.getDoctorSales);

module.exports = router;