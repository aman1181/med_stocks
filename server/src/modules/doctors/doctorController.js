const db = require("../services/dbServices");
const { v4: uuidv4 } = require("uuid");

// Get all doctors
exports.getDoctors = (req, res) => {
  try {
    const doctors = db.all(`SELECT * FROM doctors`);
    res.json(doctors);
  } catch (err) {
    console.error("Get doctors error:", err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
};

// Add doctor
exports.addDoctor = (req, res) => {
  try {
    const { name, specialization } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const id = uuidv4();
    db.run(
      `INSERT INTO doctors (uuid, name, specialization, created_at, updated_at) 
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
      [id, name, specialization || ""]
    );

    res.json({ success: true, id });
  } catch (err) {
    console.error("Add doctor error:", err);
    res.status(500).json({ error: "Failed to add doctor" });
  }
};

// Update doctor
exports.updateDoctor = (req, res) => {
  try {
    const { id } = req.params;
    const { name, specialization } = req.body;

    db.run(
      `UPDATE doctors SET name=?, specialization=?, updated_at=datetime('now') WHERE uuid=?`,
      [name, specialization, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Update doctor error:", err);
    res.status(500).json({ error: "Failed to update doctor" });
  }
};

// Delete doctor
exports.deleteDoctor = (req, res) => {
  try {
    const { id } = req.params;
    db.run(`DELETE FROM doctors WHERE uuid=?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete doctor error:", err);
    res.status(500).json({ error: "Failed to delete doctor" });
  }
};

// Get doctor sales
exports.getDoctorSales = (req, res) => {
  try {
    const { id } = req.params;
    const sales = db.all(
      `SELECT bills.uuid as bill_id, bills.bill_no, bills.date, bills.total_amount, bills.discount
       FROM bills WHERE bills.doctor_id = ? ORDER BY date DESC`,
      [id]
    );
    res.json(sales);
  } catch (err) {
    console.error("Get doctor sales error:", err);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
};
