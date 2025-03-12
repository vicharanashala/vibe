const Section = require('../../models/Course/SectionSchema');
const Assessment = require('../../models/Course/SectionItems/AssesmentSchema');

exports.createAssessment = async (req, res) => {
  try {
    const { sectionId, title, sequence } = req.body;

    // Check if the referenced section exists
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    // Create a new Assessment
    const assessment = new Assessment({
      title,
      section: sectionId,
      sequence
    });

    // Save the Assessment
    const savedAssessment = await assessment.save();

    // Link the Assessment to the Section
    section.sectionItems.push({ itemId: savedAssessment._id, itemType: "Assessment" });
    await section.save();

    // Respond with the created Assessment
    res.status(201).json({ success: true, data: savedAssessment });
  } catch (error) {
    // Handle errors
    res.status(500).json({ success: false, error: error.message });
  }
};
