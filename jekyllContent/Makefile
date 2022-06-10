
# #新建一个站点
# ##how to use:
# # make newsite site=myblog
# newsite:
# 	jekyll new $(site)

run:
	killall -9 ruby
	cd myblog && bundle exec jekyll serve > /dev/null &2>1 &
	sleep 2
	open http://localhost:4000/

release:
	cd ../ && git pull && cd -
	cp -aRvf ./myblog/_site/* ../docs/
	cd ../ && git add . && git commit -m "auto updated by script" && git push
	