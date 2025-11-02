export class ProfileController {
  static async getProfile(req, res) {
    try {
      res.json({
        message: `Welcome ${req.user.email_id}`,
        rank: req.user.rank,
        id: req.user.user_id,
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}