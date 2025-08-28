const Doctor = require('./doctorModel');

// Get doctor by ID
exports.getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    res.json(doctor);
  } catch (err) {
    console.error("Get doctor by ID error:", err);
    res.status(500).json({ error: "Failed to fetch doctor" });
  }
};
// Get all doctors
exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find();
    res.json(doctors);
  } catch (err) {
    console.error("Get doctors error:", err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
};

// Add doctor
exports.addDoctor = async (req, res) => {
  try {
    const { name, specialization, phone, email } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const doctor = new Doctor({ name, specialization, phone, email });
    await doctor.save();

    res.json({ success: true, id: doctor._id });
  } catch (err) {
    console.error("Add doctor error:", err);
    res.status(500).json({ error: "Failed to add doctor" });
  }
};

// Update doctor
exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, specialization, phone, email } = req.body;

    await Doctor.findByIdAndUpdate(id, { name, specialization, phone, email });
    res.json({ success: true });
  } catch (err) {
    console.error("Update doctor error:", err);
    res.status(500).json({ error: "Failed to update doctor" });
  }
};

// Delete doctor
exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    await Doctor.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete doctor error:", err);
    res.status(500).json({ error: "Failed to delete doctor" });
  }
};

// Get all sales (bills) for a doctor
const Bill = require('../billing/billModel');
exports.getDoctorSales = async (req, res) => {
  try {
    const { id } = req.params;
    // Find all bills for this doctor
    const bills = await Bill.find({ doctor: id });
    res.json({ success: true, doctorId: id, sales: bills });
  } catch (err) {
    console.error("Get doctor sales error:", err);
    res.status(500).json({ error: "Failed to fetch doctor sales" });
  }
};
