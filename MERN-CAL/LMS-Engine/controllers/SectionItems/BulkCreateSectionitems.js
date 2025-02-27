const Section = require('../../models/Course/SectionSchema');
const Video = require('../../models/Course/SectionItems/VideoSchema');
const Question = require('../../models/Course/SectionItems/QuestionSchema');
const Assessment = require('../../models/Course/SectionItems/AssesmentSchema');
const User = require('../../models/User/UserSchema');

exports.bulkUpload = async (req, res) => {
  try {
    const { sectionId, data } = req.body.content;

    const { firebase_id } = req.user;
    const user = await User.findOne({ firebaseUid: firebase_id });
    const createdBy = user._id;
    // Validate Section
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    let createdItems = [];

    // Process Videos (Segments)
    if (data[0] && data[0].segments) {
      const videoDocs = await Video.insertMany(
        data[0].segments.map((segment) => ({
          title: segment.title || "Untitled Video",
          description: segment.description || '',
          url: segment.video_url,
          sequence: segment.sequence, // Use provided sequence
          section: sectionId,
          startTime: segment.start_time,
          endTime: segment.end_time
        }))
      );

      // Link Videos to the Section
      const videoItems = videoDocs.map(video => ({
        itemId: video._id,
        itemType: "Video"
      }));

      section.sectionItems.push(...videoItems);
      createdItems.push(...videoDocs);
    }

    // Process Questions (Create separate assessments for each question)
    if (data[0] && data[0].questions) {
      for (const q of data[0].questions) {
        // Create an Assessment using sequence from the question
        const assessment = new Assessment({
          title: `Assessment: ${q.question}`, 
          section: sectionId,
          sequence: q.sequence // Use question's sequence
        });

        // Save the assessment to get the ID
        const savedAssessment = await assessment.save();
        console.log(q.correct_answer);
        // Create the Question document linked to the assessment
        const question = new Question({
          assessment: savedAssessment._id,
          createdBy: createdBy, // Get createdBy from request payload
          questionText: q.question,
          type: "multiple-choice",
          options: [q.option_1, q.option_2, q.option_3, q.option_4],
          answer: [q[`option_${parseInt(q.correct_answer) + 1}`]], // Map correct answer
          timeLimit: 30,
          points: 5
        });

        // Save the question
        const savedQuestion = await question.save();

        // Update the assessment with the created question
        savedAssessment.questions.push(savedQuestion._id);
        await savedAssessment.save();

        // Link the assessment to the Section
        section.sectionItems.push({ itemId: savedAssessment._id, itemType: "Assessment" });
        createdItems.push(savedAssessment);
      }
    }

    // Save the updated section
    await section.save();

    // Respond with the created items
    res.status(201).json({ success: true, message: "Bulk upload successful", data: createdItems });
  } catch (error) {
    // Handle errors
    res.status(500).json({ success: false, error: error.message });
  }
};
