agreeable-pisces
=================
experimenting with visualizing how well Teachable Machines models generalize to new data

- demo: [is it a shiba inu or a maine coon cat?](https://agreeable-pisces.glitch.me/?model=2019072393705shibamaincoon10)
- github: [https://github.com/kevinrobinson/agreeable-pisces](https://github.com/kevinrobinson/agreeable-pisces)

# idea
Can we make a way for people to try out the image classification models they make in Teachable Machines or real world data?

# what this does
This project loads a trained model, then can get new data from disk or by searching online.  It embeds [Facets Dive](https://github.com/PAIR-code/facets/tree/master/facets_dive) to start visualizing the results.

# what else would be cool
If we could add in more attributes (eg, upload a CSV) or if Teachable Machines supported bundling other labeled attributes, we could visualize those here as well.  But there may be some we can figure out automatically, in ways that are related to what Teachable Machines is doing too (eg, run plain MobileNet on each image and add those labels).  

This would let us add more accessible tools for things like subgroup analysis, and would let more non-technical people visualize and understand the social aspects of fairness questions.  Or add in counterfactuals or other parts of tools like the what-if tool ([paper](https://arxiv.org/abs/1907.04135)), especially with generating counterfactual or adversarial images.  Or maybe pull out automated "prototypes" or "criticisms" (eg, [Kim et al](http://people.csail.mit.edu/beenkim/papers/KIM2016NIPS_MMD.pdf)).  

The core idea is to make these tools accessible to young people learning about AI, as a way to demonstrate how this is how you do the work; you can't do AI without it.


# screenshots
(the way Facets Dive is included here only works on Chrome)
## in teachable machines, train model
![train](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-training.png?v=1563895444678)

## load model
![load](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-load-model.png?v=1563895443098)


### try it out on new data
#### from disk:
![from disk](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-upload.png?v=1563895445234)

#### by searching online:
![search](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-search.png?v=1563895443000)

### analyze
#### see results in Facets Dive
![results](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-search-for-shibas.png?v=1563895446657)

#### zoom in to individual images
![zoom in](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-zoom-shiba.png?v=1563895447030)

#### change the layout around
![layout](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-rework-facets.png?v=1563895447452)

### share
#### save
![save](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2Fjson.png?v=1563896142393)

#### load
![load](https://cdn.glitch.com/ab9b24c1-0ef7-44eb-8d1f-fa5b8a84c7c3%2F100-search-for-maine-coon.png?v=1563895444453)

## example models
shiba inus & maine coon cats, from [kaggle](https://www.kaggle.com/tanlikesmath/the-oxfordiiit-pet-dataset/downloads/the-oxfordiiit-pet-dataset.zip/1)
- 2019072393705shibamaincoon10
- 20190723110514shibamainecoon200
