const Module = require('../../models/Course/ModuleSchema');
const Section = require('../../models/Course/SectionSchema');

exports.fetchSectionsController = async (req, res) => {
    try {
        console.log("Fetching sections...",req.query.module_id); // Log the fetch operation
        const moduleId = req.query.module_id;  // Get moduleId from query parameters
        console.log("Module ID:", moduleId); // Log the fetched Module ID
        // Validate the moduleId
        if (!moduleId) {
            return res.status(400).json({ message: "Module ID must be provided." });
        }

        // Find the module by ID
        const module = await Module.findById(moduleId);
        if (!module) {
            return res.status(404).json({ message: "Module not found." });
        }

        // Extract the sections array from the module document
        const { sections } = module;

        // Fetch all the sections of the module using the section IDs
        const sectionsData = await Section.find({
            '_id': { $in: sections }
        });

        // If sectionsData array is empty, return a message indicating no sections found
        if (!sectionsData.length) {
            return res.status(404).json({ message: "No sections found for this module." });
        }

        // Prepare the response data by mapping over the sectionsData array
        const responseData = sectionsData.map(section => ({
            id: section._id,
            title: section.title,
            description: section.description,
            sequence: section.sequence,
            sectionItems: section.sectionItems,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt
        }));

        // Send the response data back to the client
        res.json(responseData);
    } catch (error) {
        console.error("Error fetching sections:", error);
        res.status(500).json({ message: "Error fetching sections" });
    }
};
