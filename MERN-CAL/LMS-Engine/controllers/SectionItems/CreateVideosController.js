const Section = require('../../models/Course/SectionSchema');
const Video = require('../../models/Course/SectionItems/VideoSchema');

exports.createVideos = async (req, res) => {
  try {
    const { sectionId, videos } = req.body;

    // Check if the referenced section exists
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    // Insert multiple video documents
    const videoDocs = await Video.insertMany(
      videos.map((video, index) => ({
        title: video.title || `Video ${index + 1}`,
        description: video.description || '',
        url: video.url,
        sequence: video.sequence || index + 1,
        section: sectionId,
        startTime: video.startTime,
        endTime: video.endTime
      }))
    );

    // Link videos to the section
    const createdItems = videoDocs.map(video => ({
      itemId: video._id,
      itemType: "Video"
    }));

    section.sectionItems.push(...createdItems);
    await section.save();

    // Respond with created videos
    res.status(201).json({ success: true, data: videoDocs });
  } catch (error) {
    // Handle errors
    res.status(500).json({ success: false, error: error.message });
  }
};
