// GET single vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    let vendor = await Vendor.findOne({ vendor_id: id });
    if (!vendor) {
      vendor = await Vendor.findById(id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
    }
    res.json({ success: true, vendor });
  } catch (err) {
    console.error("Get vendor by ID error:", err);
    res.status(500).json({ error: "Failed to fetch vendor", details: err.message });
  }
};

const Vendor = require('./vendorModels');

// GET all vendors
exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    // Debug: log all vendor_id and _id values
    console.log('Vendor IDs:', vendors.map(v => ({ vendor_id: v.vendor_id, _id: v._id })));
    res.json(vendors);
  } catch (err) {
    console.error("Get vendors error:", err);
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
};

// CREATE vendor
exports.addVendor = async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, gst_number } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Vendor name is required" });
    }
    const vendor = new Vendor({
      vendor_id: require('uuid').v4(),
      name: name.trim(),
      contact_person,
      phone,
      email,
      address,
      gst_number
    });
    await vendor.save();
    res.json({ success: true, id: vendor.vendor_id, vendor });
  } catch (err) {
    console.error("Add vendor error:", err);
    res.status(500).json({ error: "Failed to add vendor", details: err.message });
  }
};

// UPDATE vendor
exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address, gst_number } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Vendor name is required" });
    }
    // Try to find by vendor_id first, then by _id
    let vendor = await Vendor.findOne({ vendor_id: id });
    if (!vendor) {
      vendor = await Vendor.findById(id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
    }
    vendor.name = name.trim();
    vendor.contact_person = contact_person;
    vendor.phone = phone;
    vendor.email = email;
    vendor.address = address;
    vendor.gst_number = gst_number;
    await vendor.save();
    res.json({ success: true, vendor });
  } catch (err) {
    console.error("Update vendor error:", err);
    res.status(500).json({ error: "Failed to update vendor", details: err.message });
  }
};

// DELETE vendor
exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    // Try to find by vendor_id first, then by _id
    let vendor = await Vendor.findOne({ vendor_id: id });
    if (!vendor) {
      // Try MongoDB _id
      vendor = await Vendor.findById(id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
    }
    // TODO: Check if vendor has products in inventory before deleting
    if (vendor.vendor_id === id) {
      await Vendor.deleteOne({ vendor_id: id });
    } else {
      await Vendor.findByIdAndDelete(id);
    }
    res.json({ success: true, deletedVendor: vendor.name });
  } catch (err) {
    console.error("Delete vendor error:", err);
    res.status(500).json({ error: "Failed to delete vendor", details: err.message });
  }
};