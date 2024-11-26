from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from home.serializers import ArticleSerializer, QuestionSerializer, QuestionGroupMediaMappingSerializer
from .models import Article, Question, QuestionGroup, QuestionGroupMediaMapping, QuestionMediaMapping
from datetime import datetime

@api_view(['GET', 'POST', 'PUT', 'DELETE'])
def articles(request):

    if request.method == 'GET':
        args = request.GET.get("search")

        if args:
            articles = Article.objects.filter(title__icontains=args)
            if not articles:
                return Response({'error': 'Article not found'})
        else:
            articles = Article.objects.all()
        serializer = ArticleSerializer(articles, many=True)
        return Response(serializer.data)
    
    if request.method == 'POST':

        serializer = ArticleSerializer(data=request.data)

        if 'title' in request.data:
            article_data = Article.objects.filter(title=request.data.get('title')).first()

            if article_data:
                return Response({'error': 'Article with this title already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
        questions = request.data.get('questions') # Integer list of question ids
        question_groups = request.data.get('question_groups') # Integer list of question group ids

        if questions:
            for question in questions:
                QuestionMediaMapping.objects.create(question=question, article=serializer.instance)
        
        if question_groups:
            for group in question_groups:
                QuestionGroupMediaMapping.objects.create(question_group=group, article=serializer.instance)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'PUT':
        args = request.data.get("article_id")
        if not args:
            return Response({'error': 'Article ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            article = Article.objects.get(pk=args)
        except Article.DoesNotExist:
            return Response({'error': 'Article not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ArticleSerializer(article, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        args = request.data.get("article_id")
        if not args:
            return Response({'error': 'Article ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            article = Article.objects.get(pk=args)
        except Article.DoesNotExist:
            return Response({'error': 'Article not found'}, status=status.HTTP_404_NOT_FOUND)
        article.delete()
        return Response({'success': 'Article deleted'})
    
    return Response({'error': 'Invalid request method'}, status=status.HTTP_400_BAD_REQUEST)