# from django.db.models.signals import post_save
# from django.dispatch import receiver
# from ..models import Article
# from ..services.article_service import ArticleService
#
# @receiver(post_save, sender=Article)
# def article_post_save(sender, instance, created, **kwargs):
#     """
#     After saving a Video, sync the SectionItemInfo row.
#     """
#     ArticleService.sync_section_item_info(instance)
