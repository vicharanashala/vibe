const Section = require('../../models/Course/SectionSchema');
const Module = require('../../models/Course/ModuleSchema');

exports.createSectionController = async (req, res) => {
  try {
    // Destructure fields from request body
    const { title, moduleId, sectionItems } = req.body;

    // Check if the referenced module exists
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, message: "Module not found" });
    }

    // Find the highest sequence number for this module
    const lastSection = await Section.findOne({ module: moduleId })
      .sort({ sequence: -1 }) // Sort in descending order
      .select('sequence'); // Only retrieve sequence field

    const nextSequence = lastSection ? lastSection.sequence + 1 : 1; // Increment if exists, else start at 1

    // Create a new Section instance
    const section = new Section({
      title,
      module: moduleId,
      sectionItems: sectionItems || [], // optional: can be empty
      sequence: nextSequence,
    });

    // Save the section to the database
    const savedSection = await section.save();

    // Push the section's ObjectId into the module's sections array
    module.sections.push(savedSection._id);
    await module.save();

    // Respond with the created section
    res.status(201).json({ success: true, data: savedSection });
  } catch (error) {
    // Handle errors
    res.status(500).json({ success: false, error: error.message });
  }
};
